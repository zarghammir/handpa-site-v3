// faq.js — POST /api/faq
//
// What this teaches:
//   → Calling an external AI API from your server (not the browser)
//   → Why the API key must stay server-side
//   → System prompts — how you give an AI its personality and constraints
//   → Guardrails — how you stop it from going off-topic
//   → Returning structured JSON from an AI response

import { handleCors } from "./_lib/cors.js";
import { sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

// ─── Why call the AI from the server and not the browser? ────────────────────
// If you called Anthropic's API directly from the browser, your API key
// would be visible in the network tab to anyone who opens devtools.
// They could steal it and run up a huge bill on your account.
// The server is the only safe place to hold and use API keys.
// ─────────────────────────────────────────────────────────────────────────────

// ─── The system prompt — this is where you control everything ────────────────
// A system prompt is a set of instructions given to the AI before the user's
// message. It defines:
//   1. Who the AI is (persona)
//   2. What it knows (context about your site)
//   3. What it's allowed to answer (guardrails)
//   4. How it should respond (format, tone, length)
//
// This is the single most important piece of an AI feature.
// A bad system prompt → off-topic answers, hallucinations, wrong tone.
// A good system prompt → focused, trustworthy, on-brand answers.
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful assistant for Medya's handpan lesson website.

You answer questions from visitors about:
- Handpan lessons (online and in-person)
- Pricing and how to book
- Experience levels (complete beginners are welcome)
- What a handpan is and how it sounds
- Lesson structure and what students can expect
- Whether students need their own handpan
- Availability and scheduling
- the language she teaches

Key facts about the site:
- The instructor's name is Medya
- Lessons are available online and in-person
- Students can fill out a student intake form to get started
- There is a contact form for general questions
- Complete beginners are welcome — no experience needed
- Students do not need to own a handpan to start lessons
- She teaches in English and Farsi

Rules you must follow:
- Only answer questions related to the topics above
- If someone asks about something unrelated (politics, coding, other topics), 
  politely say you can only help with handpan lesson questions
- Keep answers concise — 2 to 3 sentences maximum
- If you are unsure about a specific detail (exact price, exact schedule), 
  tell the visitor to use the contact form for specifics
- Never make up prices or specific details you don't know ask them to eighter book a session or contact Medya via the form 
- Friendly, warm, encouraging tone. you can use a bit of humour and be funny but not insulting— like Medya herself would speak`;

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  // Rate limit: 20 questions per IP per hour
  // AI API calls cost money — you want to prevent abuse
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "faq", 20, 60 * 60);
  if (!allowed) {
    return err(res, 429, "Too many questions. Please try again later.");
  }

  const raw = req.body?.question;

  // Sanitize and validate
  const question = sanitizeText(raw, 500);
  if (!question) {
    return err(res, 400, "Please enter a question.");
  }

  try {
    // ─── Calling the Anthropic API ────────────────────────────────────────────
    // This is a plain fetch() to Anthropic's /v1/messages endpoint.
    // The shape of the request:
    //   model     → which Claude model to use
    //   max_tokens → maximum length of the response
    //   system    → the system prompt (your instructions to the AI)
    //   messages  → the conversation so far (just one message here)
    // ─────────────────────────────────────────────────────────────────────────
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // fastest + cheapest — good for FAQ
        max_tokens: 300,                     // short answers only
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: question }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Anthropic API error:", errorData);
      return err(res, 502, "Could not get an answer right now. Please try again.");
    }

    const data = await response.json();

    // ─── Reading the response ─────────────────────────────────────────────────
    // Anthropic returns: { content: [{ type: "text", text: "..." }], ... }
    // We pull out the text of the first content block.
    // ─────────────────────────────────────────────────────────────────────────
    const answer = data.content?.[0]?.text;

    if (!answer) {
      return err(res, 500, "Received an empty response. Please try again.");
    }

    return ok(res, { answer });

  } catch (e) {
    console.error("FAQ server error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}