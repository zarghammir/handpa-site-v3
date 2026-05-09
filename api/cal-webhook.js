// api/cal-webhook.js
//
// Receives webhooks from cal.com when a booking changes state.
//
// Events we handle:
//   BOOKING_CREATED      — new booking confirmed (auto for free 45-min;
//                          fires after Medya approves the gated 60-min)
//   BOOKING_RESCHEDULED  — student moved the slot — update times in our DB
//   BOOKING_CANCELLED    — student cancelled — mark booking cancelled
//
// Why this design:
//   Cal.com is the source of truth for *approval*. The 60-min event is
//   "Requires booking confirmation" so cal.com sends a request email to
//   Medya — she approves there. Only after approval does cal.com fire
//   BOOKING_CREATED to us. So bookings never live in a "pending" state
//   inside our database from cal.com's flow — they appear as confirmed.
//
//   Our dashboard subscribes to bookings via Supabase Realtime so a fresh
//   confirmation pops in without a manual refresh.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createHmac, timingSafeEqual } from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL =
  process.env.SITE_URL ||
  process.env.VITE_SITE_URL ||
  "https://handpan-lessons.vercel.app";

// ── Event-type filter ────────────────────────────────────────────────────────
// The 45-min "free intro" event is a top-of-funnel booking from the marketing
// site. It belongs in cal.com only — not the instructor dashboard. The 60-min
// "lesson" is the regular paid class and is what we track here.
//
// We match on the cal.com event-type slug. If cal.com's payload shape changes
// or a slug gets renamed, the booking will fall through to the default "store
// it" behaviour rather than silently disappearing.
const IGNORED_EVENT_SLUGS = new Set(["45min"]);

function getEventSlug(payload) {
  return (
    payload?.eventType?.slug ??
    payload?.eventTypeSlug ??
    payload?.metadata?.eventTypeSlug ??
    null
  );
}

function isIgnoredEvent(payload) {
  const slug = getEventSlug(payload);
  if (!slug) return false;
  return IGNORED_EVENT_SLUGS.has(slug);
}

// ── HMAC verification ────────────────────────────────────────────────────────
// Cal.com signs every webhook with HMAC-SHA256 of the raw body. We recompute
// and compare in constant time so an attacker can't time-attack the secret.
function verifySignature(rawBody, signature, secret) {
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
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

  // Drop free-intro (45-min) traffic before doing any work. We always 200 so
  // cal.com is satisfied and doesn't retry — we just acknowledge and return.
  if (isIgnoredEvent(payload)) {
    return res
      .status(200)
      .json({ message: "Ignored: 45-min intro is website-only." });
  }

  try {
    switch (triggerEvent) {
      case "BOOKING_CREATED":
        return await handleCreated(payload, res);

      case "BOOKING_RESCHEDULED":
        return await handleRescheduled(payload, res);

      case "BOOKING_CANCELLED":
        return await handleCancelled(payload, res);

      default:
        // Unknown event — log and ack. We always 200 so cal.com doesn't retry.
        console.log("Unhandled cal webhook event:", triggerEvent);
        return res
          .status(200)
          .json({ message: "Event received, not handled." });
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Always 200 to avoid retry storms — we log and move on.
    return res.status(200).json({ message: "Received, internal error." });
  }
}

// ── BOOKING_CREATED ──────────────────────────────────────────────────────────
async function handleCreated(payload, res) {
  const studentName = payload?.attendees?.[0]?.name ?? "Unknown";
  const studentEmail = payload?.attendees?.[0]?.email ?? null;
  const eventType = payload?.title ?? "Session";
  const startTime = payload?.startTime ?? null;
  const endTime = payload?.endTime ?? null;
  const bookingId = payload?.uid ?? null;

  const { error: dbError } = await supabase.from("bookings").upsert(
    {
      booking_id: bookingId,
      student_name: studentName,
      student_email: studentEmail,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed",
    },
    { onConflict: "booking_id" }
  );

  if (dbError) {
    console.error("Supabase upsert error:", dbError);
    return res.status(200).json({ message: "Received, but DB save failed." });
  }

  // Gift-code linking — preserved from the previous version
  const notes =
    payload?.responses?.notes?.value ?? payload?.description ?? "";
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
      await supabase
        .from("bookings")
        .update({ gift_code: giftCode, is_gift: true })
        .eq("booking_id", bookingId);
      await supabase
        .from("gift_codes")
        .update({ booking_id: bookingId })
        .eq("id", giftData.id);
      console.log(`Gift code ${giftCode} linked to booking ${bookingId}`);
    }
  }

  // Notify Medya — this fires AFTER cal.com confirmed the booking.
  // For the 60-min flow, that means she just approved it on cal.com.
  // For the 45-min flow, the booking landed without an approval step.
  const dashboardUrl = `${SITE_URL}/dashboard/instructor`;
  await resend.emails.send({
    from: "Handpan <onboarding@resend.dev>",
    to: "medy.tutoring@gmail.com",
    subject: `New session — ${studentName}${
      giftCodeMatch ? " (Gift lesson)" : ""
    }`,
    html: `
      <h2>New session confirmed${giftCodeMatch ? " 🎁 Gift lesson" : ""}</h2>
      <p><strong>Student:</strong> ${studentName}</p>
      <p><strong>Email:</strong> ${studentEmail ?? "N/A"}</p>
      <p><strong>Session:</strong> ${eventType}</p>
      <p><strong>Start:</strong> ${
        startTime ? new Date(startTime).toLocaleString() : "N/A"
      }</p>
      <p><strong>End:</strong> ${
        endTime ? new Date(endTime).toLocaleString() : "N/A"
      }</p>
      ${
        giftCodeMatch
          ? `<p><strong>Gift code:</strong> ${giftCodeMatch[0]} ✓ verified</p>`
          : ""
      }
      <p style="margin-top:24px"><a href="${dashboardUrl}" style="background:#0a3a2a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open dashboard</a></p>
    `,
  });

  return res.status(200).json({ message: "Booking saved." });
}

// ── BOOKING_RESCHEDULED ──────────────────────────────────────────────────────
async function handleRescheduled(payload, res) {
  // Cal.com sends both the old + new uids. We update by the OLD uid because
  // that's what's in our DB; if cal.com rotated the uid we fall back to upsert.
  const oldBookingId =
    payload?.rescheduleUid || payload?.bookingId || payload?.uid;
  const newBookingId = payload?.uid;
  const startTime = payload?.startTime ?? null;
  const endTime = payload?.endTime ?? null;

  if (!oldBookingId && !newBookingId) {
    return res.status(200).json({ message: "Reschedule with no uid; ignored." });
  }

  // Try update by old uid first. If 0 rows matched, upsert under new uid.
  const { data, error } = await supabase
    .from("bookings")
    .update({
      booking_id: newBookingId ?? oldBookingId,
      start_time: startTime,
      end_time: endTime,
    })
    .eq("booking_id", oldBookingId)
    .select();

  if (error) {
    console.error("Reschedule update error:", error);
    return res.status(200).json({ message: "Received, DB error." });
  }

  if (!data || data.length === 0) {
    // Old uid not found — insert defensively
    await supabase.from("bookings").upsert(
      {
        booking_id: newBookingId ?? oldBookingId,
        student_name: payload?.attendees?.[0]?.name ?? "Unknown",
        student_email: payload?.attendees?.[0]?.email ?? null,
        event_type: payload?.title ?? "Session",
        start_time: startTime,
        end_time: endTime,
        status: "confirmed",
      },
      { onConflict: "booking_id" }
    );
  }

  // Email Medya about the reschedule
  const studentName = payload?.attendees?.[0]?.name ?? "Student";
  await resend.emails.send({
    from: "Handpan <onboarding@resend.dev>",
    to: "medy.tutoring@gmail.com",
    subject: `Booking rescheduled — ${studentName}`,
    html: `
      <h2>Session rescheduled</h2>
      <p><strong>Student:</strong> ${studentName}</p>
      <p><strong>New start:</strong> ${
        startTime ? new Date(startTime).toLocaleString() : "N/A"
      }</p>
      <p><strong>New end:</strong> ${
        endTime ? new Date(endTime).toLocaleString() : "N/A"
      }</p>
      <p style="margin-top:24px"><a href="${SITE_URL}/dashboard/instructor" style="background:#0a3a2a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open dashboard</a></p>
    `,
  });

  return res.status(200).json({ message: "Booking rescheduled." });
}

// ── BOOKING_CANCELLED ────────────────────────────────────────────────────────
async function handleCancelled(payload, res) {
  const bookingId = payload?.uid ?? null;
  if (!bookingId) {
    return res.status(200).json({ message: "Cancel with no uid; ignored." });
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("booking_id", bookingId);

  if (error) {
    console.error("Cancel update error:", error);
    return res.status(200).json({ message: "Received, DB error." });
  }

  // Optional notice to Medya
  const studentName = payload?.attendees?.[0]?.name ?? "Student";
  await resend.emails.send({
    from: "Handpan <onboarding@resend.dev>",
    to: "medy.tutoring@gmail.com",
    subject: `Booking cancelled — ${studentName}`,
    html: `
      <h2>Session cancelled</h2>
      <p><strong>Student:</strong> ${studentName}</p>
      <p>The student cancelled this session via cal.com.</p>
      <p style="margin-top:24px"><a href="${SITE_URL}/dashboard/instructor" style="background:#0a3a2a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open dashboard</a></p>
    `,
  });

  return res.status(200).json({ message: "Booking cancelled." });
}
