// stripe-webhook.js — POST /api/stripe-webhook
//
// What this teaches:
//   → Webhooks from payment providers — Stripe calls YOU when payment succeeds
//   → Why you must verify the webhook signature
//     (anyone could POST to this URL and fake a successful payment)
//   → Idempotency — Stripe can send the same webhook twice
//     so we check if the code already exists before creating it
//   → Generating secure random codes with crypto.randomBytes

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";

const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Generate a human-friendly gift code ──────────────────────────────────────
// e.g. "GIFT-A3F9-B2E1"
// randomBytes gives us cryptographically secure random hex
// We take 8 hex characters and split them into two groups of 4
function generateGiftCode() {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `GIFT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  // ─── Verify the webhook signature ─────────────────────────────────────────
  // Stripe signs every webhook with your webhook secret.
  // If we skip this check, anyone could POST fake "payment succeeded" events
  // and get free gift codes.
  //
  // IMPORTANT: Stripe needs the RAW request body (not parsed JSON) to verify.
  // In Vercel, you need to disable body parsing for this route.
  // Add this export at the top of the file (outside the handler):
  // ──────────────────────────────────────────────────────────────────────────
  const sig    = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // req.body here is a Buffer because we disabled body parsing (see below)
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (e) {
    console.error("Webhook signature failed:", e.message);
    return res.status(400).json({ message: "Invalid signature." });
  }

  // We only care about successful payments
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ message: "Event received, not handled." });
  }

  const session = event.data.object;

  // Already processed? (Stripe can send duplicates)
  const { data: existing } = await supabase
    .from("gift_codes")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ message: "Already processed." });
  }

  // Pull our metadata back out of the session
  const {
    gifter_name,
    gifter_email,
    recipient_name,
    recipient_email,
    message,
  } = session.metadata;

  // Generate gift code + set expiry to 3 months from now
  const code      = generateGiftCode();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 3);

  // Save to DB
  const { error: dbError } = await supabase.from("gift_codes").insert([{
    code,
    stripe_session_id: session.id,
    gifter_name,
    gifter_email,
    recipient_name,
    recipient_email,
    amount:     session.amount_total,
    status:     "active",
    expires_at: expiresAt.toISOString(),
  }]);

  if (dbError) {
    console.error("DB error:", dbError);
    // Return 200 anyway — if we return 500, Stripe retries forever
    return res.status(200).json({ message: "DB save failed." });
  }

  // Email the gift code to the gifter
  await resend.emails.send({
    from:    "Medya Handpan <onboarding@resend.dev>",
    to:      gifter_email,
    subject: "Your handpan lesson gift code",
    html: `
      <h2>Your gift is ready!</h2>
      <p>Hi ${gifter_name},</p>
      <p>Your payment was successful. Here is the gift code to forward to ${recipient_name}:</p>
      <div style="font-size:28px;font-weight:bold;letter-spacing:4px;
                  background:#f5f5f5;padding:20px;text-align:center;
                  border-radius:8px;margin:20px 0;">
        ${code}
      </div>
      ${message ? `<p>Your personal message: "${message}"</p>` : ""}
      <p>The code expires in <strong>3 months</strong>.</p>
      <p>To redeem, ${recipient_name} visits <strong>${process.env.SITE_URL}/gift/redeem</strong> 
         and enters the code when booking.</p>
    `,
  });

  // Notify Medya
  await resend.emails.send({
    from:    "Handpan <onboarding@resend.dev>",
    to:      "medy.tutoring@gmail.com",
    subject: `New gift lesson sold — ${gifter_name} → ${recipient_name}`,
    html: `
      <p><strong>Gifter:</strong> ${gifter_name} (${gifter_email})</p>
      <p><strong>Recipient:</strong> ${recipient_name} (${recipient_email})</p>
      <p><strong>Code:</strong> ${code}</p>
      <p><strong>Expires:</strong> ${expiresAt.toLocaleDateString()}</p>
    `,
  });

  return res.status(200).json({ message: "Gift code created and sent." });
}

// ─── IMPORTANT: Disable Vercel's body parser for this route ───────────────────
// Stripe's signature verification needs the raw body bytes, not parsed JSON.
// Vercel parses the body by default — this tells it not to for this file.
export const config = {
  api: { bodyParser: false },
};