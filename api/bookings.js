// api/bookings.js
//
// PATCH endpoint for updating a booking's status — instructor only.
//
// Side effect: when status flips to "cancelled", we email the student so they
// don't show up to a session that's no longer happening. Sent fire-and-forget;
// a failed email shouldn't block the DB update.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { ok, err } from "./_lib/response.js";
import { cancelCalBooking, confirmCalBooking } from "./_lib/calcom.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL =
  process.env.SITE_URL ||
  process.env.VITE_SITE_URL ||
  "https://handpan-lessons.vercel.app";

const VALID_STATUSES = ["pending", "confirmed", "cancelled"];

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return err(res, 401, "Missing auth token.");
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !user) {
    return err(res, 401, "Invalid or expired token.");
  }

  // Only instructors can update bookings
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "instructor") {
    return err(res, 403, "Instructor only.");
  }

  if (req.method !== "PATCH") {
    return err(res, 405, "Method not allowed.");
  }

  const { id, status } = req.body;

  if (!id) return err(res, 400, "id is required.");
  if (!VALID_STATUSES.includes(status)) {
    return err(
      res,
      400,
      `status must be one of: ${VALID_STATUSES.join(", ")}.`
    );
  }

  // Fetch the existing row first so we know the previous status.
  // We email the student only when the status TRANSITIONS to cancelled —
  // otherwise re-cancelling would re-spam them.
  const { data: existing } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return err(res, 500, "Could not update booking.");
  if (!data) return err(res, 404, "Booking not found.");

  // ── Sync the change back to cal.com ──────────────────────────────────────
  //
  // Without this, our DB and cal.com diverge — Medya cancels in our dashboard
  // but cal.com still has the slot booked, sending the student reminder
  // emails for a session that's no longer happening.
  //
  // We don't fail the request if cal.com sync fails; we just attach a
  // `calSyncWarning` to the response so the dashboard can surface it.
  // `data.booking_id` is cal.com's UID for the booking (set by the webhook).
  let calSyncWarning = null;

  if (data.booking_id) {
    const becameCancelledForCal =
      status === "cancelled" && existing?.status !== "cancelled";
    const becameConfirmedForCal =
      status === "confirmed" && existing?.status === "pending";

    if (becameCancelledForCal) {
      const result = await cancelCalBooking(
        data.booking_id,
        "Cancelled by instructor"
      );
      if (!result.ok) calSyncWarning = `Cal.com cancel failed: ${result.error}`;
    } else if (becameConfirmedForCal) {
      const result = await confirmCalBooking(data.booking_id);
      if (!result.ok) calSyncWarning = `Cal.com confirm failed: ${result.error}`;
    }
  }

  // ── Side effect: notify student when newly cancelled ────────────────────
  const becameCancelled =
    status === "cancelled" && existing?.status !== "cancelled";

  if (becameCancelled && data.student_email) {
    const startStr = data.start_time
      ? new Date(data.start_time).toLocaleString()
      : "your scheduled time";
    // Fire and forget — don't block the response
    resend.emails
      .send({
        from: "Handpan <onboarding@resend.dev>",
        to: data.student_email,
        subject: "Your handpan session has been cancelled",
        html: `
          <h2>Session cancelled</h2>
          <p>Hi ${data.student_name ?? "there"},</p>
          <p>
            Unfortunately, your handpan session scheduled for
            <strong>${startStr}</strong> has been cancelled by your instructor.
          </p>
          <p>
            You can book a new session anytime at
            <a href="${SITE_URL}">our website</a>.
            If you have any questions, just reply to this email.
          </p>
          <p>— ${profile.full_name ?? "Medya"}</p>
        `,
      })
      .catch((e) => console.error("Cancel email failed:", e));
  }

  return ok(res, { booking: data, calSyncWarning });
}
