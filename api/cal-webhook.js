import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createHmac, timingSafeEqual } from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

function verifySignature(rawBody, signature, secret) {
  const computed = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  const signature = req.headers["x-cal-signature-256"];
  if (!signature) {
    return res.status(401).json({ message: "Missing signature." });
  }

  const rawBody = JSON.stringify(req.body);
  const isValid = verifySignature(
    rawBody,
    signature,
    process.env.CAL_WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ message: "Invalid signature." });
  }

  const { triggerEvent, payload } = req.body;

  if (triggerEvent !== "BOOKING_CREATED") {
    return res.status(200).json({ message: "Event received, not handled." });
  }

  try {
    const studentName  = payload?.attendees?.[0]?.name  ?? "Unknown";
    const studentEmail = payload?.attendees?.[0]?.email ?? null;
    const eventType    = payload?.title                 ?? "Session";
    const startTime    = payload?.startTime             ?? null;
    const endTime      = payload?.endTime               ?? null;
    const bookingId    = payload?.uid                   ?? null;

    // Save booking to DB
    const { error: dbError } = await supabase
      .from("bookings")
      .upsert(
        {
          booking_id:   bookingId,
          student_name: studentName,
          student_email: studentEmail,
          event_type:   eventType,
          start_time:   startTime,
          end_time:     endTime,
          status:       "confirmed",
        },
        { onConflict: "booking_id" }
      );

    if (dbError) {
      console.error("Supabase upsert error:", dbError);
      return res.status(200).json({ message: "Received, but DB save failed." });
    }

    // ─── Gift code linking ─────────────────────────────────────────────────
    // Check if the student included a gift code in their booking notes.
    // Cal.com stores custom field responses in payload.responses
    const notes = payload?.responses?.notes?.value
               ?? payload?.description
               ?? "";

    const giftCodeMatch = notes.match(/GIFT-[A-F0-9]{4}-[A-F0-9]{4}/);

    if (giftCodeMatch) {
      const giftCode = giftCodeMatch[0];

      const { data: giftData } = await supabase
        .from("gift_codes")
        .select("id, status")
        .eq("code", giftCode)
        .eq("status", "redeemed")
        .maybeSingle();

      if (giftData) {
        // Link booking to gift code
        await supabase
          .from("bookings")
          .update({ gift_code: giftCode, is_gift: true })
          .eq("booking_id", bookingId);

        // Link gift code to booking
        await supabase
          .from("gift_codes")
          .update({ booking_id: bookingId })
          .eq("id", giftData.id);

        console.log(`Gift code ${giftCode} linked to booking ${bookingId}`);
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Send notification email to Medya
    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New booking — ${studentName}${giftCodeMatch ? " (Gift lesson)" : ""}`,
      html: `
        <h2>New Session Booked${giftCodeMatch ? " 🎁 Gift Lesson" : ""}</h2>
        <p><strong>Student:</strong> ${studentName}</p>
        <p><strong>Email:</strong> ${studentEmail ?? "N/A"}</p>
        <p><strong>Session:</strong> ${eventType}</p>
        <p><strong>Start:</strong> ${startTime ? new Date(startTime).toLocaleString() : "N/A"}</p>
        <p><strong>End:</strong> ${endTime ? new Date(endTime).toLocaleString() : "N/A"}</p>
        ${giftCodeMatch ? `<p><strong>Gift code:</strong> ${giftCodeMatch[0]} ✓ verified</p>` : ""}
      `,
    });

    return res.status(200).json({ message: "Booking saved." });

  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(200).json({ message: "Received, internal error." });
  }
}