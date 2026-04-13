// api/chat-end.js — POST /api/chat-end
//
// Called by the frontend when the user closes the chat widget.
// Sends the conversation summary email to Medya.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { sanitizeText } from "./_lib/sanitize.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendSummaryEmail(sessionId) {
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("messages, booked, created_at, email_sent")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session) return;
  if (session.email_sent) return; // already sent — inactivity timer and close can both fire

  const { data: lead } = await supabase
    .from("chat_leads")
    .select("name, email, timezone, completed, booking_uid")
    .eq("session_id", sessionId)
    .maybeSingle();

  const transcript = (session.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.content.startsWith("[SYSTEM ACTION RESULT"))
    .map((m) => {
      const label = m.role === "user" ? "👤 Visitor" : "🤖 Assistant";
      return `<p><strong>${label}:</strong> ${m.content}</p>`;
    })
    .join("");

  const bookedStatus = session.booked
    ? `✅ <strong>Session booked</strong> — Booking ID: ${lead?.booking_uid ?? "N/A"}`
    : `❌ <strong>Not booked</strong> — ${lead ? "Lead captured, follow up recommended" : "No contact details captured"}`;

  const { error } = await resend.emails.send({
    from: "Handpan <onboarding@resend.dev>",
    to: "medy.tutoring@gmail.com",
    subject: lead
      ? `Chat summary — ${lead.name} (${session.booked ? "Booked ✅" : "Not booked ❌"})`
      : `Chat summary — Anonymous visitor`,
    html: `
      <h2>Chat Conversation Summary</h2>

      <div style="background:#f5f5f0;padding:16px;border-radius:8px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px;">Booking Status</h3>
        <p style="margin:0;font-size:16px;">${bookedStatus}</p>
      </div>

      ${lead ? `
      <div style="background:#f5f5f0;padding:16px;border-radius:8px;margin-bottom:20px;">
        <h3 style="margin:0 0 12px;">Visitor Details</h3>
        <p><strong>Name:</strong> ${lead.name}</p>
        <p><strong>Email:</strong> ${lead.email}</p>
        <p><strong>Timezone:</strong> ${lead.timezone}</p>
      </div>
      ` : ""}

      <div style="background:#f5f5f0;padding:16px;border-radius:8px;">
        <h3 style="margin:0 0 12px;">Full Transcript</h3>
        ${transcript || "<p>No messages recorded.</p>"}
      </div>

      <p style="color:#999;font-size:12px;margin-top:20px;">
        Session ID: ${sessionId} — Started: ${new Date(session.created_at).toLocaleString()}
      </p>
    `,
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