import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { handleCors } from "./_lib/cors.js";
import { escapeHtml, sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "testimonial-submit", 3, 60 * 60); // 3/hour
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  try {
    const name = sanitizeText(req.body?.name, 100);
    const country = sanitizeText(req.body?.country, 100);
    const text = sanitizeText(req.body?.text, 500);

    if (!name || !country || !text) {
      return err(res, 400, "All fields are required.");
    }

    if (text.length > 500) {
      return err(res, 400, "Testimonial must be under 500 characters.");
    }

    // Generate a random token — 32 bytes turned into a hex string (64 characters).
    // This is what makes the approval link secret and unguessable.
    const approvalToken = randomBytes(32).toString("hex");

    const { error } = await supabase.from("testimonials").insert([
      {
        name,
        country,
        text,
        approved: false,
        approval_token: approvalToken,
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return err(res, 500, "Could not save your testimonial.");
    }

    // Build the approval link.
    // SITE_URL is an env variable set in Vercel, e.g. https://your-site.vercel.app
    const approvalLink = `${process.env.SITE_URL}/api/testimonial-approve?token=${approvalToken}`;

    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New testimonial from ${escapeHtml(name)} — approve?`,
      html: `
        <h2>New Testimonial Submitted</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Country:</strong> ${escapeHtml(country)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(text)}</p>
        <br />
        <a
          href="${approvalLink}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background: #E67E22;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          "
        >
          Approve this testimonial
        </a>
        <br /><br />
        <p style="color: #999; font-size: 12px;">
          This link works once and expires after use.
        </p>
      `,
    });

    return ok(res, { message: "Thank you! Your testimonial has been submitted for review." });
  } catch (e) {
    console.error("Server error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}
