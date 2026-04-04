import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { escapeHtml, sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "student-intake", 3, 60 * 60 * 24); // 3/day
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  try {
    const {
      full_name,
      email,
      phone,
      lesson_mode,
      in_person_location_type,
      student_address,
      experience_level,
      has_handpan,
      availability_preferences,
      message,
    } = req.body ?? {};

    if (!full_name || !email || !lesson_mode || !experience_level) {
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

    const cleanName = sanitizeText(full_name, 100);
    const cleanEmail = sanitizeText(email, 200);
    const cleanPhone = sanitizeText(phone, 30);
    const cleanAddress = sanitizeText(student_address, 300);
    const cleanMessage = sanitizeText(message, 1000);

    const { error } = await supabase.from("student_intakes").insert([
      {
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        lesson_mode,
        in_person_location_type: in_person_location_type || null,
        student_address: cleanAddress || null,
        experience_level,
        has_handpan,
        availability_preferences,
        message: cleanMessage || null,
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return err(res, 500, "Could not save your form. Please try again.");
    }

    // Email to instructor
    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: ["medy.tutoring@gmail.com"],
      subject: `New student intake from ${escapeHtml(cleanName)}`,
      html: `
        <h2>New Student Intake</h2>
        <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(cleanEmail)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(cleanPhone) || "N/A"}</p>
        <p><strong>Lesson Mode:</strong> ${escapeHtml(lesson_mode)}</p>
        <p><strong>Location:</strong> ${escapeHtml(in_person_location_type || "N/A")}</p>
        <p><strong>Address:</strong> ${escapeHtml(cleanAddress) || "N/A"}</p>
        <p><strong>Experience:</strong> ${escapeHtml(experience_level)}</p>
        <p><strong>Has Handpan:</strong> ${has_handpan ? "Yes" : "No"}</p>
        <pre>${escapeHtml(JSON.stringify(availability_preferences, null, 2))}</pre>
        <p>${escapeHtml(cleanMessage)}</p>
      `,
    });

    // Confirmation email to student
    await resend.emails.send({
      from: "Medya Handpan <onboarding@resend.dev>",
      to: [cleanEmail],
      subject: "Your handpan lesson request received",
      html: `
        <h2>Hi ${escapeHtml(cleanName)},</h2>
        <p>Thank you for your interest in handpan lessons!</p>
        <p>I've received your request and will get back to you within 1–2 business days.</p>
        <p>Looking forward to starting your journey.</p>
        <p><strong>Medya</strong></p>
      `,
    });

    return ok(res, { message: "Your request has been submitted successfully." });
  } catch (error) {
    console.error("Server error:", error);
    return err(res, 500, "Server error. Please try again.");
  }
}
