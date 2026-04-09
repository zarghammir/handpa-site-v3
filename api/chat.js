// api/chat.js — POST /api/chat
//
// What this teaches:
//   → Agentic loop: Claude decides actions, server executes them
//   → Multi-turn conversation via stateless message history
//   → Cal.com API: checking availability + creating bookings
//   → Session persistence: saving transcripts to Supabase
//   → Lead capture: saving name + email before booking completes
//   → Email notifications: lead captured + booking confirmed

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const CAL_API_BASE = "https://api.cal.com/v2";
const CAL_EVENT_TYPE_ID = process.env.CAL_EVENT_TYPE_ID;
const CAL_API_KEY = process.env.CAL_API_KEY;

// ─── Cal.com helpers ──────────────────────────────────────────────────────────

async function fetchAvailableSlots(timeZone = "America/Vancouver") {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const params = new URLSearchParams({
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    eventTypeId: CAL_EVENT_TYPE_ID,
    timeZone,
  });

  const response = await fetch(`${CAL_API_BASE}/slots?${params}`, {
    headers: {
      Authorization: `Bearer ${CAL_API_KEY}`,
      "cal-api-version": "2024-09-04",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Cal.com slots error:", error);
    throw new Error("Could not fetch availability.");
  }

  const data = await response.json();
  const slots = data.data?.slots ?? {};
  const lines = [];

  for (const [date, times] of Object.entries(slots)) {
    if (!times.length) continue;

    const dateObj = new Date(date + "T00:00:00");
    const dayLabel = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone,
    });

    const timeLabels = times.map((slot) =>
      new Date(slot.time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      })
    );

    lines.push(`${dayLabel}: ${timeLabels.join(", ")}`);
  }

  return lines.length
    ? lines.join("\n")
    : "No availability found in the next 7 days.";
}

async function createBooking({ attendeeName, attendeeEmail, startTime, timeZone }) {
  const response = await fetch(`${CAL_API_BASE}/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CAL_API_KEY}`,
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
    },
    body: JSON.stringify({
      eventTypeId: Number(CAL_EVENT_TYPE_ID),
      start: startTime,
      attendee: {
        name: attendeeName,
        email: attendeeEmail,
        timeZone,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Cal.com booking error:", error);
    throw new Error(error.message ?? "Could not create booking.");
  }

  const data = await response.json();
  return data.data;
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function saveSession(sessionId, messages, ip) {
  const { error } = await supabase
    .from("chat_sessions")
    .upsert(
      {
        session_id: sessionId,
        messages,
        ip,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

  if (error) console.error("Session save error:", error);
}

async function saveLead(sessionId, name, email, timezone) {
  const { error } = await supabase
    .from("chat_leads")
    .upsert(
      {
        session_id: sessionId,
        name,
        email,
        timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

  if (error) console.error("Lead save error:", error);
}

async function markLeadCompleted(sessionId, bookingUid) {
  // Mark lead as completed
  const { error: leadError } = await supabase
    .from("chat_leads")
    .update({
      completed: true,
      booking_uid: bookingUid,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (leadError) console.error("Lead update error:", leadError);

  // Mark session as booked so the summary email shows correct status
  const { error: sessionError } = await supabase
    .from("chat_sessions")
    .update({ booked: true })
    .eq("session_id", sessionId);

  if (sessionError) console.error("Session booked update error:", sessionError);
}

// ─── Email helper ─────────────────────────────────────────────────────────────
// Formats and sends the conversation summary email to Medya.
// Called from chat-end.js (widget closed) and the pg_cron inactivity job.
// Exported so chat-end.js can import and reuse it.

export async function sendSummaryEmail(sessionId) {
  // Fetch the full session + lead data
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("messages, booked, created_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session) return; // session not found, nothing to send

  const { data: lead } = await supabase
    .from("chat_leads")
    .select("name, email, timezone, completed, booking_uid")
    .eq("session_id", sessionId)
    .maybeSingle();

  // Format the transcript as readable HTML
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

  // Mark email as sent so the inactivity job doesn't send it again
  await supabase
    .from("chat_sessions")
    .update({ email_sent: true })
    .eq("session_id", sessionId);
}

// ─── Action marker parser ─────────────────────────────────────────────────────

function parseAction(text) {
  const availMatch = text.match(/\[CHECK_AVAILABILITY([^\]]*)\]/);
  if (availMatch) {
    const tzMatch = availMatch[1].match(/timeZone="([^"]+)"/);
    return {
      type: "CHECK_AVAILABILITY",
      timeZone: tzMatch?.[1] ?? "America/Vancouver",
    };
  }

  const leadMatch = text.match(/\[SAVE_LEAD([^\]]+)\]/);
  if (leadMatch) {
    const attrs = {};
    const attrRegex = /(\w+)="([^"]+)"/g;
    let m;
    while ((m = attrRegex.exec(leadMatch[1])) !== null) {
      attrs[m[1]] = m[2];
    }
    return { type: "SAVE_LEAD", ...attrs };
  }

  const bookingMatch = text.match(/\[CREATE_BOOKING([^\]]+)\]/);
  if (bookingMatch) {
    const attrs = {};
    const attrRegex = /(\w+)="([^"]+)"/g;
    let m;
    while ((m = attrRegex.exec(bookingMatch[1])) !== null) {
      attrs[m[1]] = m[2];
    }
    return { type: "CREATE_BOOKING", ...attrs };
  }

  return null;
}

// ─── Claude call helper ───────────────────────────────────────────────────────

async function callClaude(messages, systemPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Anthropic error:", error);
    throw new Error("Could not reach Claude.");
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Medya's friendly handpan lesson assistant. You help visitors learn about lessons and book sessions.

You can answer questions about:
- What a handpan is and how it sounds
- Lesson format: online or in-person in North Vancouver
- Complete beginners are very welcome — no experience needed
- Students do not need to own a handpan
- Free 45-minute intro session to start
- Ongoing lessons are $50/session
- Medya teaches in English and Farsi

BOOKING FLOW — follow these steps exactly when someone wants to book:
1. Ask for their full name (if you don't have it)
2. Ask for their email address (if you don't have it)
3. Ask for their timezone — if they say a city like "Vancouver" use "America/Vancouver"
4. Once you have name, email AND timezone, output exactly this and nothing else:
   [SAVE_LEAD name="FULL_NAME" email="EMAIL" timeZone="TIMEZONE"]
5. After the lead is saved, immediately output:
   [CHECK_AVAILABILITY timeZone="TIMEZONE"]
6. After availability results are shown to you, present the options clearly and ask which slot they prefer
7. When the user confirms a specific slot, output exactly this and nothing else:
   [CREATE_BOOKING attendeeName="FULL_NAME" attendeeEmail="EMAIL" startTime="ISO_DATETIME_UTC" timeZone="TIMEZONE"]
   Convert their chosen time to UTC for startTime. Example: 2026-04-14T17:00:00Z

Important rules for markers:
- Output markers on their own line
- Do not add any text after a marker — stop there
- Never output a marker unless you have all required information
- Never invent or guess availability — always use CHECK_AVAILABILITY first

General rules:
- Keep answers to 2-3 sentences max
- Warm, encouraging tone — a little humour is fine
- Never invent prices, schedules, or availability
- Only answer questions related to handpan lessons
- If asked anything unrelated, politely redirect`;

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "chat", 40, 60 * 60);
  if (!allowed) {
    return err(res, 429, "Too many messages. Please try again later.");
  }

  const rawMessages = req.body?.messages;
  const sessionId = sanitizeText(req.body?.sessionId ?? "", 100);

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return err(res, 400, "Messages array is required.");
  }

  if (!sessionId) {
    return err(res, 400, "Session ID is required.");
  }

  const messages = rawMessages
    .slice(-30)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: sanitizeText(String(m.content ?? ""), 1000),
    }));

  if (messages[messages.length - 1]?.role !== "user") {
    return err(res, 400, "Last message must be from the user.");
  }

  try {
    // ── Step 1: First Claude call ─────────────────────────────────────────────
    let reply = await callClaude(messages, SYSTEM_PROMPT);

    // ── Step 2: Parse for action markers ─────────────────────────────────────
    const action = parseAction(reply);

    // ── Step 3: Save session transcript ──────────────────────────────────────
    const fullMessages = [
      ...messages,
      { role: "assistant", content: reply },
    ];
    await saveSession(sessionId, fullMessages, ip);

    if (!action) {
      return ok(res, { reply });
    }

    // ── Step 4: Execute the action ────────────────────────────────────────────
    let actionResult = "";

    if (action.type === "SAVE_LEAD") {
      await saveLead(sessionId, action.name, action.email, action.timeZone);

      try {
        const slots = await fetchAvailableSlots(action.timeZone);
        actionResult = `Lead saved. Available slots:\n${slots}`;
      } catch {
        actionResult = "Lead saved. Could not fetch availability — ask the user to try again.";
      }
    }

    if (action.type === "CHECK_AVAILABILITY") {
      try {
        const slots = await fetchAvailableSlots(action.timeZone);
        actionResult = `Available slots for the next 7 days:\n${slots}`;
      } catch {
        actionResult = "Could not fetch availability. Ask the user to try again or use the contact form.";
      }
    }

    if (action.type === "CREATE_BOOKING") {
      const { attendeeName, attendeeEmail, startTime, timeZone } = action;

      if (!attendeeName || !attendeeEmail || !startTime) {
        actionResult = "Missing booking details. Ask the user to confirm their name, email, and chosen time slot.";
      } else {
        try {
          const booking = await createBooking({
            attendeeName,
            attendeeEmail,
            startTime,
            timeZone: timeZone ?? "America/Vancouver",
          });

          await markLeadCompleted(sessionId, booking.uid);

          actionResult = `Booking confirmed! Booking ID: ${booking.uid}. Session starts: ${booking.start}. Confirmation email sent to ${attendeeEmail}.`;
        } catch (e) {
          actionResult = `Booking failed: ${e.message}. Apologize and suggest they use the contact form or try again.`;
        }
      }
    }

    // ── Step 5: Second Claude call with action result ─────────────────────────
    const enrichedMessages = [
      ...messages,
      { role: "assistant", content: reply },
      {
        role: "user",
        content: `[SYSTEM ACTION RESULT — do not mention this label]: ${actionResult}`,
      },
    ];

    const finalReply = await callClaude(enrichedMessages, SYSTEM_PROMPT);

    // Update session with final reply
    await saveSession(
      sessionId,
      [...enrichedMessages, { role: "assistant", content: finalReply }],
      ip
    );

    return ok(res, { reply: finalReply });

  } catch (e) {
    console.error("Chat error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}