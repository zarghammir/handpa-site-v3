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

    const submissionDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New testimonial from ${escapeHtml(name)} — approve?`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Testimonial</title>
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
              <h1 style="margin:0 0 10px 0;font-size:26px;font-weight:700;color:#f7f4ef;line-height:1.2;">New Testimonial</h1>
              <p style="margin:0;font-size:13px;color:#6b7a99;">${submissionDate}</p>
            </td>
          </tr>

          <!-- Name banner -->
          <tr>
            <td style="background:linear-gradient(90deg,#b8882a,#d4a840);padding:16px 44px;text-align:center;">
              <p style="margin:0;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${escapeHtml(name)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:8px 44px 44px;border-radius:0 0 14px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Details section -->
                <tr>
                  <td style="padding:28px 0 14px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-bottom:2px solid #ede8e0;padding-bottom:10px;">
                          <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a044;font-weight:700;">Submission Details</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #f3f0ec;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="150" style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;vertical-align:top;padding-top:2px;">Name</td>
                        <td style="font-size:15px;color:#1f2937;font-weight:500;line-height:1.5;">${escapeHtml(name)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:11px 0;border-bottom:1px solid #f3f0ec;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="150" style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;vertical-align:top;padding-top:2px;">Country</td>
                        <td style="font-size:15px;color:#1f2937;font-weight:500;line-height:1.5;">${escapeHtml(country)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Message section -->
                <tr>
                  <td style="padding:28px 0 14px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-bottom:2px solid #ede8e0;padding-bottom:10px;">
                          <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a044;font-weight:700;">Testimonial</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:18px 20px;background:#faf8f4;border-radius:8px;border-left:3px solid #c9a044;">
                          <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;font-style:italic;">&ldquo;${escapeHtml(text)}&rdquo;</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA section -->
                <tr>
                  <td style="padding:32px 0 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${approvalLink}" style="display:inline-block;padding:16px 40px;background:linear-gradient(90deg,#b8882a,#d4a840);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;letter-spacing:0.3px;">Approve This Testimonial</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0 0 0;text-align:center;">
                          <p style="margin:0;font-size:12px;color:#9ca3af;">This link works once and expires after use.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

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
</html>`,
    });

    return ok(res, { message: "Thank you! Your testimonial has been submitted for review." });
  } catch (e) {
    console.error("Server error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}
