import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { escapeHtml } from "./_lib/sanitize.js";
import { EMAIL_FROM, OWNER_EMAIL } from "./_lib/email.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const resend = new Resend(process.env.RESEND_API_KEY);

function generateGiftCode() {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `GIFT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  // Read raw body manually — required for Stripe signature verification
  // Vercel parses req.body by default which corrupts the signature check
  const rawBody = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error("Webhook signature failed:", e.message);
    return res.status(400).json({ message: "Invalid signature." });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ message: "Event received, not handled." });
  }

  const session = event.data.object;

  // Idempotency check — Stripe can send the same webhook twice
  const { data: existing } = await supabase
    .from("gift_codes")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ message: "Already processed." });
  }

  const {
    gifter_name,
    gifter_email,
    recipient_name,
    recipient_email,
    message,
  } = session.metadata;

  const code = generateGiftCode();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 3);

  const { error: dbError } = await supabase.from("gift_codes").insert([
    {
      code,
      stripe_session_id: session.id,
      gifter_name,
      gifter_email,
      recipient_name,
      recipient_email,
      amount: session.amount_total,
      status: "active",
      expires_at: expiresAt.toISOString(),
    },
  ]);

  if (dbError) {
    console.error("DB error:", dbError);
    // 500 makes Stripe retry the webhook — the payment already succeeded, so
    // silently dropping the gift code here would lose the sale. The
    // idempotency check above keeps retries from creating duplicates.
    return res.status(500).json({ message: "DB save failed, please retry." });
  }

  // Emails are best-effort: the code is safely in the database at this point,
  // so a Resend failure must not 500 (a Stripe retry would hit the
  // idempotency check and the email would never be attempted again anyway).
  try {
    // Email the gift code to the gifter
    const { error: gifterEmailError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: gifter_email,
      subject: "Your handpan lesson gift code",
      html: `
    <h2>Your gift is ready!</h2>
    <p>Hi ${escapeHtml(gifter_name)},</p>
    <p>Your payment was successful. Here is the gift code to forward to ${escapeHtml(recipient_name)}:</p>
    <div style="font-size:28px;font-weight:bold;letter-spacing:4px;
                background:#f5f5f5;padding:20px;text-align:center;
                border-radius:8px;margin:20px 0;">
      ${code}
    </div>
    ${message ? `<p>Their personal message: "${escapeHtml(message)}"</p>` : ""}
    <p>The code expires in <strong>3 months</strong>.</p>
    <p>${escapeHtml(recipient_name)} can redeem it at <strong>${process.env.SITE_URL}/gift/redeem</strong></p>
  `,
    });
    if (gifterEmailError) console.error("Gifter email failed:", gifterEmailError);

    // Instructor notification
    const { error: ownerEmailError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: OWNER_EMAIL,
      subject: `New gift lesson sold — ${gifter_name} → ${recipient_name}`,
      html: `
    <h2>New gift lesson sold</h2>
    <p><strong>Gifter:</strong> ${escapeHtml(gifter_name)} (${escapeHtml(gifter_email)})</p>
    <p><strong>Recipient:</strong> ${escapeHtml(recipient_name)} (${escapeHtml(recipient_email)})</p>
    <p><strong>Gift code:</strong> ${code}</p>
    <p><strong>Expires:</strong> ${expiresAt.toLocaleDateString()}</p>
    <p><strong>Amount:</strong> $${(session.amount_total / 100).toFixed(2)}</p>
  `,
    });
    if (ownerEmailError) console.error("Owner email failed:", ownerEmailError);
  } catch (e) {
    console.error("Gift email send threw:", e);
  }

  return res.status(200).json({ message: "Gift code created and sent." });
}

// CRITICAL — disables Vercel's automatic body parsing for this route
// Stripe needs the raw request body bytes to verify the signature
export const config = {
  api: { bodyParser: false },
};
