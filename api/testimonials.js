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

async function handleGet(req, res) {
  if (req.query?.token) return handleApprove(req, res);

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "testimonials-get", 30, 60);
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  const { data, error } = await supabase
    .from("testimonials")
    .select("id, name, country, text, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
    return err(res, 500, "Could not fetch testimonials.");
  }

  return ok(res, { testimonials: data });
}

function renderApprovePage(message, success) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${success ? "Approved" : "Error"}</title>
    <style>
      body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #FAFAF5; }
      .card { text-align: center; padding: 48px; border-radius: 24px; border: 1px solid #EBD5AB; background: white; max-width: 400px; }
      .icon { font-size: 48px; margin-bottom: 16px; }
      h1 { color: #2D3B1F; font-size: 22px; margin: 0 0 12px; }
      p { color: #2D3B1F99; font-size: 15px; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">${success ? "✅" : "❌"}</div>
      <h1>${success ? "Approved!" : "Something went wrong"}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

async function handleApprove(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(renderApprovePage("Invalid link.", false));
  }

  const { data, error } = await supabase
    .from("testimonials")
    .select("id, name")
    .eq("approval_token", token)
    .eq("approved", false)
    .single();

  if (error || !data) {
    return res.status(404).send(renderApprovePage("This link is invalid or has already been used.", false));
  }

  const { error: updateError } = await supabase
    .from("testimonials")
    .update({ approved: true, approval_token: null })
    .eq("id", data.id);

  if (updateError) {
    console.error("Supabase update error:", updateError);
    return res.status(500).send(renderApprovePage("Something went wrong. Please try again.", false));
  }

  return res.status(200).send(renderApprovePage(`Testimonial from ${data.name} is now live.`, true));
}

async function handlePost(req, res) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "testimonial-submit", 3, 60 * 60);
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  const name = sanitizeText(req.body?.name, 100);
  const country = sanitizeText(req.body?.country, 100);
  const text = sanitizeText(req.body?.text, 500);

  if (!name || !country || !text) {
    return err(res, 400, "All fields are required.");
  }

  if (text.length > 500) {
    return err(res, 400, "Testimonial must be under 500 characters.");
  }

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

  const approvalLink = `${process.env.SITE_URL}/api/testimonials?token=${approvalToken}`;

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
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return err(res, 405, "Method not allowed.");
  } catch (e) {
    console.error("Server error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}
