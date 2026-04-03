import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createHmac, timingSafeEqual } from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Signature verification ───────────────────────────────────────────────────
// Cal.com signs every webhook request with your secret key.
// We recompute the signature and compare — if they match, the request is genuine.
//
// timingSafeEqual is used instead of === for the comparison.
// Regular === stops comparing the moment it finds a difference (short-circuit).
// An attacker can measure how long the comparison takes and guess the secret
// one character at a time. timingSafeEqual always takes the same amount of time
// regardless of where the strings differ, so timing attacks don't work.
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
    // timingSafeEqual throws if the buffers are different lengths
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  // Cal.com sends the signature in this header
  const signature = req.headers["x-cal-signature-256"];

  if (!signature) {
    return res.status(401).json({ message: "Missing signature." });
  }

  // To verify the signature we need the raw request body as a string,
  // not the already-parsed JSON object. Vercel gives us req.body as
  // a parsed object by default, so we re-serialize it.
  // Note: in production you'd want to capture the raw body before parsing.
  const rawBody = JSON.stringify(req.body);

  const isValid = verifySignature(
    rawBody,
    signature,
    process.env.CAL_WEBHOOK_SECRET
  );

  if (!isValid) {
    console.error("Webhook signature mismatch — request rejected.");
    return res.status(401).json({ message: "Invalid signature." });
  }

  // ─── Signature verified — safe to trust the payload ───────────────────────
  const { triggerEvent, payload } = req.body;

  // Cal.com sends many event types: BOOKING_CREATED, BOOKING_CANCELLED,
  // BOOKING_RESCHEDULED, etc. We only act on the ones we care about.
  // Returning 200 for events we ignore is correct — it tells Cal.com
  // "I received this, I just don't need to do anything with it."
  if (triggerEvent !== "BOOKING_CREATED") {
    return res.status(200).json({ message: "Event received, not handled." });
  }

  try {
    // Extract what we need from the Cal.com payload
    const studentName  = payload?.attendees?.[0]?.name   ?? "Unknown";
    const studentEmail = payload?.attendees?.[0]?.email  ?? null;
    const eventType    = payload?.title                  ?? "Session";
    const startTime    = payload?.startTime              ?? null;
    const endTime      = payload?.endTime                ?? null;
    const bookingId    = payload?.uid                    ?? null;

    // Save to database
    // .upsert with onConflict:"booking_id" means:
    // if this booking_id already exists, update it instead of creating a duplicate.
    // This protects you if Cal.com sends the same webhook twice (it can happen).
    const { error: dbError } = await supabase
      .from("bookings")
      .upsert(
        {
          booking_id:    bookingId,
          student_name:  studentName,
          student_email: studentEmail,
          event_type:    eventType,
          start_time:    startTime,
          end_time:      endTime,
          status:        "confirmed",
        },
        { onConflict: "booking_id" }
      );

    if (dbError) {
      console.error("Supabase upsert error:", dbError);
      // We still return 200 here intentionally.
      // If we returned 500, Cal.com would keep retrying the webhook.
      // The booking already happened on their side — we just failed to save it.
      // Log it and investigate manually rather than causing a retry loop.
      return res.status(200).json({ message: "Received, but DB save failed." });
    }

    // Send notification email to you
    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New booking — ${studentName}`,
      html: `
        <h2>New Session Booked</h2>
        <p><strong>Student:</strong> ${studentName}</p>
        <p><strong>Email:</strong> ${studentEmail ?? "N/A"}</p>
        <p><strong>Session:</strong> ${eventType}</p>
        <p><strong>Start:</strong> ${startTime ? new Date(startTime).toLocaleString() : "N/A"}</p>
        <p><strong>End:</strong> ${endTime ? new Date(endTime).toLocaleString() : "N/A"}</p>
      `,
    });

    return res.status(200).json({ message: "Booking saved." });
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Same reasoning as above — return 200 to stop Cal.com retrying
    return res.status(200).json({ message: "Received, internal error." });
  }
}