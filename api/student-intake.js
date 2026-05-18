import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { escapeHtml, sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatLabel(val) {
  if (!val) return "N/A";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #f3f0ec;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="150" style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;vertical-align:top;padding-top:2px;">${label}</td>
            <td style="font-size:15px;color:#1f2937;font-weight:500;line-height:1.5;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function sectionHeader(title) {
  return `
    <tr>
      <td style="padding:28px 0 14px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-bottom:2px solid #ede8e0;padding-bottom:10px;">
              <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a044;font-weight:700;">${title}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  // ── Authenticate ────────────────────────────────────────────────────────
  // Onboarding is gated behind login — the client sends the Supabase access
  // token in the Authorization header. We verify it server-side so the
  // service_role write below targets the right profile row.
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return err(res, 401, "You must be signed in to submit this form.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return err(res, 401, "Your session is invalid. Please sign in again.");
  }
  const authUser = userData.user;

  // The student profile tab uses ?type=availability-update so the dashboard
  // can update preferences AND notify Medya in one request — onboarding still
  // routes through the default (no query) path.
  if (req.query?.type === "availability-update") {
    return handleAvailabilityUpdate(req, res, authUser);
  }

  // Per-user rate limit (3 onboarding submissions per day) — keyed on user id
  // rather than IP so the limit follows the account.
  const { allowed } = await checkRateLimit(`user:${authUser.id}`, "student-intake", 3, 60 * 60 * 24);
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  try {
    const {
      lesson_mode,
      in_person_location_type,
      student_address,
      experience_level,
      has_handpan,
      availability_preferences,
      message,
    } = req.body ?? {};

    if (!lesson_mode || !experience_level) {
      return err(res, 400, "Please fill in all required fields.");
    }

    if (lesson_mode === "in_person" && !in_person_location_type) {
      return err(res, 400, "Please choose an in-person location option.");
    }

    if (
      lesson_mode === "in_person" &&
      in_person_location_type === "student_place" &&
      !student_address
    ) {
      return err(res, 400, "Please enter your address for in-person lessons at your place.");
    }

    if (
      !Array.isArray(availability_preferences) ||
      availability_preferences.length === 0
    ) {
      return err(res, 400, "Please choose at least one day and time range.");
    }

    for (const slot of availability_preferences) {
      if (!slot.day || !slot.start || !slot.end) {
        return err(res, 400, "Each selected day must include a start and end time.");
      }
      if (slot.end <= slot.start) {
        return err(res, 400, `For ${slot.day}, end time must be later than start time.`);
      }
    }

    // Pull the trusted name/email from the profile row (set at registration),
    // not the request body. maybeSingle() returns null instead of erroring
    // when the row doesn't exist — we'll fall back to upsert below.
    const { data: profileRow, error: profileLookupErr } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileLookupErr) {
      console.error("Profile lookup error:", profileLookupErr, { userId: authUser.id });
      return err(res, 500, "Could not load your profile. Please try again.");
    }

    const cleanName = sanitizeText(
      profileRow?.full_name || authUser.user_metadata?.full_name || "",
      100
    );
    const cleanEmail = sanitizeText(
      profileRow?.email || authUser.email || "",
      200
    );
    const cleanPhone = "";
    const cleanAddress = sanitizeText(student_address, 300);
    const cleanMessage = sanitizeText(message, 1000);

    // Write the onboarding answers onto the profile and flip the gate.
    // upsert (instead of update) is defensive: if the Register-time insert
    // raced with a Supabase auth trigger and the profile is missing, we
    // create it here. .select().single() forces PostgREST to return the
    // affected row so we can verify onboarding_complete actually became
    // true — an empty .update() would otherwise pass silently.
    const { data: savedRow, error: profileUpsertErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          full_name: cleanName || null,
          email: cleanEmail || null,
          role: "student",
          lesson_mode,
          in_person_location_type: in_person_location_type || null,
          student_address: cleanAddress || null,
          experience_level,
          has_handpan,
          availability_preferences,
          onboarding_message: cleanMessage || null,
          onboarding_complete: true,
        },
        { onConflict: "id" }
      )
      .select("id, onboarding_complete")
      .single();

    if (profileUpsertErr || !savedRow?.onboarding_complete) {
      console.error("Profile upsert error:", profileUpsertErr, {
        userId: authUser.id,
        savedRow,
      });
      return err(res, 500, "Could not save your onboarding. Please try again.");
    }

    // --- Build shared template parts ---

    const submissionDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const availabilityRows = availability_preferences
      .map(
        (slot, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#faf8f5"};">
        <td style="padding:12px 18px;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #ede8e0;">${escapeHtml(slot.day)}</td>
        <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #ede8e0;">${escapeHtml(formatTime(slot.start))} &ndash; ${escapeHtml(formatTime(slot.end))}</td>
      </tr>`
      )
      .join("");

    const messageBlock = cleanMessage
      ? `
      ${sectionHeader("Message")}
      <tr>
        <td style="padding:4px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:18px 20px;background:#faf8f4;border-radius:8px;border-left:3px solid #c9a044;">
                <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;font-style:italic;">&ldquo;${escapeHtml(cleanMessage)}&rdquo;</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
      : "";

    // --- Instructor email ---

    const instructorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Student Intake</title>
</head>
<body style="margin:0;padding:0;background-color:#edeae5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edeae5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0d0d1a;border-radius:14px 14px 0 0;padding:44px 44px 36px;text-align:center;">
              <p style="margin:0 0 14px 0;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#c9a044;font-weight:700;">Handpan Lessons</p>
              <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:700;color:#f7f4ef;letter-spacing:-0.3px;line-height:1.2;">New Student Intake</h1>
              <p style="margin:0;font-size:13px;color:#6b7a99;">${submissionDate}</p>
            </td>
          </tr>

          <!-- Name banner -->
          <tr>
            <td style="background:linear-gradient(90deg,#b8882a,#d4a840);padding:16px 44px;text-align:center;">
              <p style="margin:0;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${escapeHtml(cleanName)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:8px 44px 44px;border-radius:0 0 14px 14px;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                ${sectionHeader("Contact Information")}
                ${infoRow("Email", `<a href="mailto:${escapeHtml(cleanEmail)}" style="color:#1d6fa8;text-decoration:none;">${escapeHtml(cleanEmail)}</a>`)}
                ${infoRow("Phone", escapeHtml(cleanPhone) || "N/A")}

                ${sectionHeader("Lesson Details")}
                ${infoRow("Mode", formatLabel(lesson_mode))}
                ${lesson_mode === "in_person" ? infoRow("Location Type", formatLabel(in_person_location_type || "N/A")) : ""}
                ${cleanAddress ? infoRow("Address", escapeHtml(cleanAddress)) : ""}
                ${infoRow("Experience", formatLabel(experience_level))}
                ${infoRow("Has Handpan", has_handpan ? "Yes &#10003;" : "No")}

                ${sectionHeader("Availability")}
                <tr>
                  <td style="padding:4px 0 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #ede8e0;">
                      <tr style="background:#f5f2ed;">
                        <td style="padding:10px 18px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;width:45%;">Day</td>
                        <td style="padding:10px 18px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;">Available Window</td>
                      </tr>
                      ${availabilityRows}
                    </table>
                  </td>
                </tr>

                ${messageBlock}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 0 8px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#b0aaa0;">Sent automatically from your Handpan Lessons website</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // --- Student confirmation email ---

    const studentAvailabilityList = availability_preferences
      .map((slot) => `<li style="margin:0 0 6px 0;font-size:15px;color:#4b5563;">${escapeHtml(slot.day)}: ${escapeHtml(formatTime(slot.start))} &ndash; ${escapeHtml(formatTime(slot.end))}</li>`)
      .join("");

    const studentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lesson Request Received</title>
</head>
<body style="margin:0;padding:0;background-color:#edeae5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edeae5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0d0d1a;border-radius:14px 14px 0 0;padding:44px 44px 36px;text-align:center;">
              <p style="margin:0 0 14px 0;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#c9a044;font-weight:700;">Handpan Lessons</p>
              <h1 style="margin:0 0 10px 0;font-size:26px;font-weight:700;color:#f7f4ef;line-height:1.2;">Request Received!</h1>
              <p style="margin:0;font-size:15px;color:#a0aec0;">We&rsquo;ll be in touch very soon.</p>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#b8882a,#d4a840);padding:4px 0;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 44px 44px;border-radius:0 0 14px 14px;">

              <p style="margin:0 0 20px 0;font-size:22px;font-weight:700;color:#1f2937;">Hi ${escapeHtml(cleanName)},</p>

              <p style="margin:0 0 24px 0;font-size:15px;color:#4b5563;line-height:1.7;">
                Thank you for your interest in handpan lessons! I&rsquo;ve received your request and will get back to you within <strong>1&ndash;2 business days</strong> to confirm a time that works best.
              </p>

              <!-- Summary box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#faf8f4;border-radius:10px;border:1px solid #ede8e0;padding:24px 28px;">
                    <p style="margin:0 0 14px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a044;font-weight:700;">Your Submission Summary</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="130" style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;padding:6px 0;">Mode</td>
                        <td style="font-size:14px;color:#374151;font-weight:500;padding:6px 0;">${formatLabel(lesson_mode)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;padding:6px 0;">Experience</td>
                        <td style="font-size:14px;color:#374151;font-weight:500;padding:6px 0;">${formatLabel(experience_level)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;padding:6px 0;vertical-align:top;">Availability</td>
                        <td style="padding:6px 0;">
                          <ul style="margin:0;padding:0 0 0 16px;">
                            ${studentAvailabilityList}
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px 0;font-size:15px;color:#4b5563;line-height:1.7;">
                Looking forward to starting your handpan journey!
              </p>

              <!-- Sign-off -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:24px;border-top:1px solid #ede8e0;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#1f2937;">Medya</p>
                    <p style="margin:0;font-size:13px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Handpan Instructor</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 0 8px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#b0aaa0;">You&rsquo;re receiving this because you submitted a lesson request on the Handpan Lessons website.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Email to instructor
    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: ["medy.tutoring@gmail.com"],
      subject: `New student intake from ${escapeHtml(cleanName)}`,
      html: instructorHtml,
    });

    // Confirmation email to student
    await resend.emails.send({
      from: "Medya Handpan <onboarding@resend.dev>",
      to: [cleanEmail],
      subject: "Your handpan lesson request received",
      html: studentHtml,
    });

    return ok(res, { message: "Your request has been submitted successfully." });
  } catch (error) {
    console.error("Server error:", error);
    return err(res, 500, "Server error. Please try again.");
  }
}

// ────────────────────────────────────────────────────────────────────────
// AVAILABILITY UPDATE (from the student profile tab)
// ────────────────────────────────────────────────────────────────────────
// Persists the new lesson_mode + availability_preferences and emails Medya
// so she knows the student's schedule changed. Validation mirrors the
// onboarding path, but we don't require experience_level / has_handpan
// since those don't appear on the profile tab.
async function handleAvailabilityUpdate(req, res, authUser) {
  // Tighter rate limit than onboarding — students shouldn't be hammering
  // this from the profile tab. 10/day comfortably covers fix-ups while
  // blocking abuse.
  const { allowed } = await checkRateLimit(
    `user:${authUser.id}`,
    "availability-update",
    10,
    60 * 60 * 24
  );
  if (!allowed) {
    return err(res, 429, "Too many updates. Please try again later.");
  }

  try {
    const {
      lesson_mode,
      in_person_location_type,
      student_address,
      availability_preferences,
    } = req.body ?? {};

    if (!lesson_mode) {
      return err(res, 400, "Lesson mode is required.");
    }
    if (lesson_mode === "in_person" && !in_person_location_type) {
      return err(res, 400, "Please choose an in-person location option.");
    }
    if (
      lesson_mode === "in_person" &&
      in_person_location_type === "student_place" &&
      !student_address
    ) {
      return err(res, 400, "Please enter your address for in-person lessons at your place.");
    }
    if (!Array.isArray(availability_preferences) || availability_preferences.length === 0) {
      return err(res, 400, "Please choose at least one day and time range.");
    }
    for (const slot of availability_preferences) {
      if (!slot.day || !slot.start || !slot.end) {
        return err(res, 400, "Each selected day must include a start and end time.");
      }
      if (slot.end <= slot.start) {
        return err(res, 400, `For ${slot.day}, end time must be later than start time.`);
      }
    }

    const cleanAddress = sanitizeText(student_address, 300);

    // Pull the role too so we can refuse if anyone but a student hits this
    // endpoint. That would normally only happen via a cross-tab session swap
    // (Supabase shares its session via localStorage) — without this guard the
    // instructor's own row could accidentally end up overwritten with a
    // student's availability payload.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileRow?.role && profileRow.role !== "student") {
      return err(
        res,
        403,
        "This endpoint is for student profiles only. Please sign in as the student."
      );
    }

    // Email always reflects who the auth token said we are. The fallback used
    // to be `authUser.email` *as the displayed name* when full_name was empty,
    // which produced confusing "user@example.com updated their availability"
    // copy — now we show "(no name on file)" instead so the address bar is
    // never mistaken for a display name.
    const cleanEmail = sanitizeText(authUser.email || profileRow?.email || "", 200);
    const cleanName  = sanitizeText(profileRow?.full_name || "(no name on file)", 100);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        lesson_mode,
        in_person_location_type:
          lesson_mode === "in_person" ? in_person_location_type || null : null,
        student_address:
          lesson_mode === "in_person" && in_person_location_type === "student_place"
            ? cleanAddress || null
            : null,
        availability_preferences,
      })
      .eq("id", authUser.id);

    if (updateErr) {
      console.error("Availability update error:", updateErr);
      return err(res, 500, "Could not save your changes. Please try again.");
    }

    // Build the instructor email — same visual language as the onboarding
    // intake template, but trimmed to the fields the student can change.
    const availabilityRows = availability_preferences
      .map(
        (slot, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#faf8f5"};">
        <td style="padding:12px 18px;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #ede8e0;">${escapeHtml(slot.day)}</td>
        <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #ede8e0;">${escapeHtml(formatTime(slot.start))} &ndash; ${escapeHtml(formatTime(slot.end))}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Student availability updated</title></head>
<body style="margin:0;padding:0;background-color:#edeae5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edeae5;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#0d0d1a;border-radius:14px 14px 0 0;padding:36px 44px 28px;text-align:center;">
          <p style="margin:0 0 12px 0;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#c9a044;font-weight:700;">Handpan Lessons</p>
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#f7f4ef;line-height:1.2;">Availability updated</h1>
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#b8882a,#d4a840);padding:14px 44px;text-align:center;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(cleanName)}</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:24px 44px 36px;border-radius:0 0 14px 14px;">
          <p style="margin:0 0 18px 0;font-size:14px;color:#4b5563;line-height:1.6;">
            ${escapeHtml(cleanName)} (<a href="mailto:${escapeHtml(cleanEmail)}" style="color:#1d6fa8;text-decoration:none;">${escapeHtml(cleanEmail)}</a>) just updated their schedule in the dashboard.
          </p>
          ${sectionHeader("Lesson Mode")}
          ${infoRow("Mode", formatLabel(lesson_mode))}
          ${lesson_mode === "in_person" ? infoRow("Location Type", formatLabel(in_person_location_type || "N/A")) : ""}
          ${lesson_mode === "in_person" && cleanAddress ? infoRow("Address", escapeHtml(cleanAddress)) : ""}
          ${sectionHeader("Availability")}
          <tr><td style="padding:4px 0 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #ede8e0;">
              <tr style="background:#f5f2ed;">
                <td style="padding:10px 18px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;width:45%;">Day</td>
                <td style="padding:10px 18px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;">Available Window</td>
              </tr>
              ${availabilityRows}
            </table>
          </td></tr>
        </td></tr>
        <tr><td style="padding:22px 0 8px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#b0aaa0;">Sent automatically from your Handpan Lessons dashboard</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    // Fire-and-forget — the dashboard save is what the student actually
    // cares about. We still await so Resend errors surface in logs.
    try {
      await resend.emails.send({
        from: "Handpan <onboarding@resend.dev>",
        to: ["medy.tutoring@gmail.com"],
        subject: `${cleanName} updated their availability`,
        html,
      });
    } catch (mailErr) {
      console.warn("Availability email failed:", mailErr?.message || mailErr);
    }

    return ok(res, { message: "Profile updated." });
  } catch (error) {
    console.error("Availability update error:", error);
    return err(res, 500, "Server error. Please try again.");
  }
}
