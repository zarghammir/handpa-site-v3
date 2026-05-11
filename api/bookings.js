// api/bookings.js
//
// Multiple booking-related endpoints, merged into a single serverless function
// because Vercel Hobby caps us at 12 functions. Dispatched by `?action=...`:
//
//   (no action) PATCH    — instructor updates a booking's status (legacy)
//   ?action=send-reminders            (GET, cron) — send reminder emails
//   ?action=reminder-settings (GET)   — read the singleton settings row
//   ?action=reminder-settings (PUT)   — instructor updates settings
//   ?action=test-reminder      (POST) — instructor sends a test email to self
//
// The cron path authenticates with `Authorization: Bearer <CRON_SECRET>`
// (Vercel Cron sets this automatically). All other paths require a Supabase
// user JWT plus an instructor role.

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

// Reminders use the verified lotushandpan.com domain in Resend. The other
// email handlers in this codebase still send from onboarding@resend.dev —
// that's a separate cleanup tracked for a follow-up PR.
const REMINDER_FROM = "Lotus Handpan <hello@lotushandpan.com>";

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const action = (req.query?.action || "").toString();

  // ── Cron path — no user JWT, gated by CRON_SECRET ─────────────────────────
  // Must run BEFORE the bearer-token check because Vercel Cron uses the same
  // Authorization header but with the cron secret, not a Supabase JWT.
  if (action === "send-reminders") {
    return await handleSendReminders(req, res);
  }

  // ── All other paths require a Supabase user JWT ──────────────────────────
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

  // Every remaining action is instructor-only, so look up the profile once.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "instructor") {
    return err(res, 403, "Instructor only.");
  }

  // ── Action dispatcher ─────────────────────────────────────────────────────
  if (action === "reminder-settings") {
    if (req.method === "GET") return await handleGetReminderSettings(res);
    if (req.method === "PUT")
      return await handleUpdateReminderSettings(req, res, user);
    return err(res, 405, "Method not allowed.");
  }

  if (action === "test-reminder") {
    if (req.method !== "POST") return err(res, 405, "Method not allowed.");
    return await handleTestReminder(req, res, user, profile);
  }

  // ── Default — PATCH status update (existing single-purpose endpoint) ─────
  if (req.method !== "PATCH") {
    return err(res, 405, "Method not allowed.");
  }
  return await handleBookingPatch(req, res, profile);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — instructor updates a booking's status (legacy behavior, untouched)
// ─────────────────────────────────────────────────────────────────────────────
async function handleBookingPatch(req, res, profile) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Reminder helpers
// ─────────────────────────────────────────────────────────────────────────────

// Render a template by substituting {{placeholders}}. Unknown placeholders are
// left intact so a typo in a custom template doesn't silently swallow output
// — Medya will see the literal "{{wrong_name}}" in her test email and notice.
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match
  );
}

// Build the placeholder values from a booking row.
function buildTemplateVars(booking, instructorName, hoursUntil) {
  const start = booking.start_time ? new Date(booking.start_time) : null;
  return {
    student_name: booking.student_name || "there",
    session_date: start
      ? start.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : "your scheduled day",
    session_time: start
      ? start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "your scheduled time",
    instructor_name: instructorName || "Medya",
    hours_until: hoursUntil,
    event_type: booking.event_type || "Handpan session",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// send-reminders — cron handler
// ─────────────────────────────────────────────────────────────────────────────
//
// Strategy: pick up every confirmed booking whose start_time is within the
// configured offset window AND that we haven't reminded yet. The
// `reminder_sent_at IS NULL` check + the migration's trigger (which clears
// that column on reschedule) gives us duplicate-send protection automatically.
//
// We always return 200 with a summary even on partial failures, so Vercel
// Cron doesn't retry the whole batch and double-send the successful ones.
async function handleSendReminders(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return err(res, 500, "CRON_SECRET not configured.");

  // Accept the secret via Authorization header (how Vercel Cron sends it)
  // or as a `?secret=` query param (useful for manual curl testing).
  const received =
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
    req.query?.secret ||
    "";
  if (received !== expected) return err(res, 401, "Bad cron secret.");

  const { data: settings, error: settingsErr } = await supabase
    .from("reminder_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (settingsErr || !settings) {
    return err(res, 500, "Reminder settings not found.");
  }
  if (!settings.enabled) {
    return ok(res, { skipped: true, reason: "disabled" });
  }

  const nowIso = new Date().toISOString();
  const windowEndIso = new Date(
    Date.now() + settings.reminder_offset_hours * 3_600_000
  ).toISOString();

  const { data: bookings, error: bookingsErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("start_time", nowIso)
    .lte("start_time", windowEndIso);

  if (bookingsErr) {
    console.error("Reminder fetch error:", bookingsErr);
    return err(res, 500, "Could not fetch bookings.");
  }

  // Single lookup for instructor name — applied to every reminder this run.
  const { data: instructorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("role", "instructor")
    .limit(1)
    .single();
  const instructorName = instructorProfile?.full_name || "Medya";

  const results = { sent: 0, skipped: 0, errors: [] };

  for (const booking of bookings || []) {
    if (!booking.student_email) {
      results.skipped++;
      continue;
    }
    // Use the actual hours-to-start, not the configured offset — they differ
    // when a student booked inside the window (e.g. 4h before a 12h offset).
    const hoursUntil = Math.max(
      1,
      Math.round(
        (new Date(booking.start_time).getTime() - Date.now()) / 3_600_000
      )
    );
    const vars = buildTemplateVars(booking, instructorName, hoursUntil);
    const subject = renderTemplate(settings.email_subject, vars);
    const html = renderTemplate(settings.email_body, vars);

    try {
      await resend.emails.send({
        from: REMINDER_FROM,
        to: booking.student_email,
        subject,
        html,
      });
      await supabase
        .from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
      results.sent++;
    } catch (e) {
      console.error(`Reminder send failed for booking ${booking.id}:`, e);
      results.errors.push({ id: booking.id, message: e.message });
    }
  }

  return ok(res, results);
}

// ─────────────────────────────────────────────────────────────────────────────
// reminder-settings GET / PUT
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetReminderSettings(res) {
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    return err(res, 500, "Could not load reminder settings.");
  }
  return ok(res, { settings: data });
}

async function handleUpdateReminderSettings(req, res, user) {
  const {
    enabled,
    reminder_offset_hours,
    email_subject,
    email_body,
  } = req.body || {};

  if (typeof enabled !== "boolean") {
    return err(res, 400, "enabled must be a boolean.");
  }
  if (
    !Number.isInteger(reminder_offset_hours) ||
    reminder_offset_hours < 1 ||
    reminder_offset_hours > 72
  ) {
    return err(res, 400, "reminder_offset_hours must be between 1 and 72.");
  }
  if (typeof email_subject !== "string" || !email_subject.trim()) {
    return err(res, 400, "email_subject is required.");
  }
  if (typeof email_body !== "string" || !email_body.trim()) {
    return err(res, 400, "email_body is required.");
  }

  const { data, error } = await supabase
    .from("reminder_settings")
    .update({
      enabled,
      reminder_offset_hours,
      email_subject,
      email_body,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    console.error("Reminder settings update error:", error);
    return err(res, 500, "Could not save reminder settings.");
  }
  return ok(res, { settings: data });
}

// ─────────────────────────────────────────────────────────────────────────────
// test-reminder POST — render the (possibly unsaved) template with sample
// data and email it to the caller. Accepts an optional draft body so the
// dashboard can preview unsaved edits.
// ─────────────────────────────────────────────────────────────────────────────
async function handleTestReminder(req, res, user, profile) {
  const { data: settings } = await supabase
    .from("reminder_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (!settings) return err(res, 500, "Reminder settings not found.");

  const subjectTpl = req.body?.email_subject || settings.email_subject;
  const bodyTpl = req.body?.email_body || settings.email_body;
  const offsetHours =
    req.body?.reminder_offset_hours || settings.reminder_offset_hours;

  const fakeBooking = {
    student_name: profile.full_name || "Student Name",
    start_time: new Date(Date.now() + offsetHours * 3_600_000).toISOString(),
    event_type: "60-min handpan lesson",
  };
  const vars = buildTemplateVars(
    fakeBooking,
    profile.full_name || "Medya",
    offsetHours
  );
  const subject = `[TEST] ${renderTemplate(subjectTpl, vars)}`;
  const html =
    `<div style="background:#fff3cd;padding:12px;border:1px solid #ffeaa7;` +
    `border-radius:6px;margin-bottom:16px;font-family:sans-serif">` +
    `<strong>This is a test reminder.</strong> Real students will not see this banner.` +
    `</div>` +
    renderTemplate(bodyTpl, vars);

  try {
    await resend.emails.send({
      from: REMINDER_FROM,
      to: user.email,
      subject,
      html,
    });
    return ok(res, { sent: true, to: user.email });
  } catch (e) {
    console.error("Test reminder failed:", e);
    return err(res, 500, `Send failed: ${e.message}`);
  }
}
