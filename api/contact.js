// ─── contact.js — POST /api/contact ──────────────────────────────────────────
//
// This is a POST endpoint. POST means "the client is sending data to the server
// to trigger an action." Here, the action is: send an email to the instructor.
//
// Request flow (what happens when someone submits the contact form):
//
//   Browser (ContactForm.jsx)
//     → POST /api/contact  { name, email, message }
//       ↓
//   This function (runs on Vercel's servers, not in the browser)
//     1. handleCors()    — set CORS headers, handle preflight
//     2. method check    — reject anything that isn't POST
//     3. checkRateLimit  — reject if this IP has called too many times recently
//     4. sanitizeText()  — trim + cap length of all user inputs
//     5. validate        — reject if any required field is missing
//     6. resend.send()   — call the Resend API to deliver the email
//     7. ok() / err()    — send a JSON response back to the browser
//       ↓
//   Browser reads the response
//     → shows success message or error message to the user
//
// Why does the email sending happen on the server and not in the browser?
//   Your Resend API key would need to be in the browser to call Resend directly.
//   Anyone visiting the site could steal it and send unlimited emails under
//   your account. Keeping it server-side means only your code can use it.
// ─────────────────────────────────────────────────────────────────────────────

import { Resend } from "resend";
import { handleCors } from "./_lib/cors.js";
import { escapeHtml, sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

// Resend client is initialized once at module load, not inside the handler.
// This is more efficient — the SDK object is reused across warm invocations.
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Step 1: CORS — set headers and handle OPTIONS preflight
  // Returns true if this was a preflight (we're done), false for real requests
  if (handleCors(req, res)) return;

  // Step 2: Method guard — this route only accepts POST
  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  // Step 3: Rate limiting — 5 requests per IP per hour
  // getClientIp reads X-Forwarded-For (Vercel's real client IP header)
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "contact", 5, 60 * 60);
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  try {
    // Step 4: Sanitize — trim whitespace and cap length before doing anything with the data
    // req.body?.name uses optional chaining (?.) in case req.body is undefined
    const name = sanitizeText(req.body?.name, 100);
    const email = sanitizeText(req.body?.email, 200);
    const message = sanitizeText(req.body?.message, 2000);

    // Step 5: Validate — empty strings are falsy in JS, so !name catches ""
    if (!name || !email || !message) {
      return err(res, 400, "Please fill in all fields.");
    }

    // Step 6: Send email via Resend
    // escapeHtml() wraps every variable that goes into the HTML string
    // — if name is "<script>", it becomes "&lt;script&gt;" in the email
    const { error } = await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New message from ${escapeHtml(name)}`,
      replyTo: email, // lets instructor hit Reply and it goes to the student
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      `,
    });

    // Resend returns { data, error } — check error separately from HTTP errors
    if (error) {
      console.error("Resend error:", error);
      return err(res, 500, error.message || "Email failed to send.");
    }

    // Step 7: Success — send 200 JSON back to the browser
    return ok(res, { message: "Message sent successfully." });
  } catch (e) {
    // Unexpected error (network issue, Resend down, etc.)
    console.error(e);
    return err(res, 500, "Server error.");
  }
}
