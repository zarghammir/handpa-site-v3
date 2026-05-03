// api/chat-end.js — POST /api/chat-end
//
// Called by the frontend when the user closes the chat widget.
// Sends the conversation summary email to Medya.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { sanitizeText, escapeHtml } from "./_lib/sanitize.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

function chatBubble(role, content) {
  const isUser = role === "user";
  const safe = escapeHtml(content);

  if (isUser) {
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td width="68%" valign="top">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f5f2ed;border-radius:4px 14px 14px 14px;padding:12px 16px;">
                <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;word-break:break-word;">${safe}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:5px 2px 0;font-size:11px;color:#9ca3af;letter-spacing:0.5px;">Visitor</td>
            </tr>
          </table>
        </td>
        <td width="32%"></td>
      </tr>
    </table>`;
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td width="32%"></td>
        <td width="68%" valign="top" align="right">
          <table role="presentation" cellpadding="0" cellspacing="0" align="right">
            <tr>
              <td style="background:#0d0d1a;border-radius:14px 4px 14px 14px;padding:12px 16px;text-align:left;">
                <p style="margin:0;font-size:14px;color:#f7f4ef;line-height:1.6;word-break:break-word;">${safe}</p>
              </td>
            </tr>
            <tr>
              <td align="right" style="padding:5px 2px 0;font-size:11px;color:#9ca3af;letter-spacing:0.5px;">Medya</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

async function sendSummaryEmail(sessionId) {
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("messages, booked, created_at, email_sent")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session) return;
  if (session.email_sent) return;

  const { data: lead } = await supabase
    .from("chat_leads")
    .select("name, email, timezone, completed, booking_uid")
    .eq("session_id", sessionId)
    .maybeSingle();

  const messages = (session.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.content.startsWith("[SYSTEM ACTION RESULT"));

  const transcriptHtml =
    messages.length > 0
      ? messages.map((m) => chatBubble(m.role, m.content)).join("")
      : `<p style="margin:0;font-size:14px;color:#9ca3af;text-align:center;padding:20px 0;">No messages recorded.</p>`;

  const isBooked = session.booked;
  const statusBg = isBooked ? "#f0fdf4" : "#fff7ed";
  const statusBorder = isBooked ? "#bbf7d0" : "#fed7aa";
  const statusColor = isBooked ? "#166534" : "#9a3412";
  const statusIcon = isBooked ? "✅" : "❌";
  const statusText = isBooked
    ? `Session booked &mdash; Booking ID: ${escapeHtml(lead?.booking_uid ?? "N/A")}`
    : `Not booked &mdash; ${lead ? "Lead captured, follow up recommended" : "No contact details captured"}`;

  const sessionDate = new Date(session.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const visitorRows = lead
    ? `
    ${infoRow("Name", escapeHtml(lead.name))}
    ${infoRow("Email", `<a href="mailto:${escapeHtml(lead.email)}" style="color:#1d6fa8;text-decoration:none;">${escapeHtml(lead.email)}</a>`)}
    ${infoRow("Timezone", escapeHtml(lead.timezone || "N/A"))}
    ${lead.booking_uid ? infoRow("Booking ID", escapeHtml(lead.booking_uid)) : ""}
  `
    : "";

  const bannerGradient = isBooked
    ? "background:linear-gradient(90deg,#1a6b3c,#22a159)"
    : "background:linear-gradient(90deg,#b8882a,#d4a840)";

  const visitorLabel = lead ? escapeHtml(lead.name) : "Anonymous Visitor";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Chat Summary</title>
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
              <h1 style="margin:0 0 10px 0;font-size:26px;font-weight:700;color:#f7f4ef;line-height:1.2;">Chat Summary</h1>
              <p style="margin:0;font-size:13px;color:#6b7a99;">${sessionDate}</p>
            </td>
          </tr>

          <!-- Visitor / status banner -->
          <tr>
            <td style="${bannerGradient};padding:16px 44px;text-align:center;">
              <p style="margin:0;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${statusIcon}&nbsp; ${visitorLabel}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:8px 44px 44px;border-radius:0 0 14px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Booking status -->
                ${sectionHeader("Booking Status")}
                <tr>
                  <td style="padding:4px 0 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:${statusBg};border:1px solid ${statusBorder};border-radius:8px;padding:14px 18px;">
                          <p style="margin:0;font-size:14px;font-weight:600;color:${statusColor};">${statusIcon}&nbsp; ${statusText}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${lead ? `${sectionHeader("Visitor Details")}${visitorRows}` : ""}

                <!-- Transcript -->
                ${sectionHeader("Conversation")}
                <tr>
                  <td style="padding:8px 0 0 0;">
                    ${transcriptHtml}
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 0 8px 0;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#b0aaa0;">Session ID: ${escapeHtml(sessionId)}</p>
              <p style="margin:0;font-size:12px;color:#b0aaa0;">Sent automatically from your Handpan Lessons chat widget</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: "Handpan <onboarding@resend.dev>",
    to: "medy.tutoring@gmail.com",
    subject: lead
      ? `Chat summary — ${lead.name} (${isBooked ? "Booked ✅" : "Not booked ❌"})`
      : `Chat summary — Anonymous visitor`,
    html,
  });

  if (error) {
    console.error("Summary email error:", error);
    return;
  }

  await supabase
    .from("chat_sessions")
    .update({ email_sent: true })
    .eq("session_id", sessionId);
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  const sessionId = sanitizeText(req.body?.sessionId ?? "", 100);

  if (!sessionId) {
    return err(res, 400, "Session ID is required.");
  }

  try {
    await sendSummaryEmail(sessionId);
    return ok(res, { message: "Summary sent." });
  } catch (e) {
    console.error("chat-end error:", e);
    return err(res, 500, "Server error.");
  }
}
