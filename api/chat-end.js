// api/chat-end.js — POST /api/chat-end
//
// Called by the frontend when the user closes the chat widget.
// Sends the conversation summary email immediately.
// The inactivity job (pg_cron) handles the case where the user
// just abandons the page without closing the widget.

import { handleCors } from "./_lib/cors.js";
import { sanitizeText } from "./_lib/sanitize.js";
import { ok, err } from "./_lib/response.js";
import { sendSummaryEmail } from "./chat.js";

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