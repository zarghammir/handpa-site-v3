// stripe-checkout.js — POST /api/stripe-checkout
//
// What this teaches:
//   → Stripe Checkout Sessions — you create a "session" on your server
//     and redirect the user to Stripe's hosted payment page
//   → Why the price is set on the SERVER not the frontend
//     (if it was in the browser, anyone could change it to $1)
//   → Storing metadata on a Stripe session so your webhook
//     knows who the gifter/recipient are when payment succeeds

import Stripe from "stripe";
import { handleCors } from "./_lib/cors.js";
import { sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Price is hardcoded on the server — never trust the frontend for this
const LESSON_PRICE_CENTS = 5; // $50.00

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "stripe-checkout", 10, 60 * 60);
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  const {
    gifter_name,
    gifter_email,
    recipient_name,
    recipient_email,
    message,
  } = req.body ?? {};

  if (!gifter_name || !gifter_email || !recipient_name || !recipient_email) {
    return err(res, 400, "Please fill in all required fields.");
  }

  const cleanGifterName     = sanitizeText(gifter_name, 100);
  const cleanGifterEmail    = sanitizeText(gifter_email, 200);
  const cleanRecipientName  = sanitizeText(recipient_name, 100);
  const cleanRecipientEmail = sanitizeText(recipient_email, 200);
  const cleanMessage        = sanitizeText(message, 500);

  try {
    // ─── Create a Stripe Checkout Session ─────────────────────────────────
    // This creates a temporary payment page on Stripe's servers.
    // The student is redirected there to enter their card details.
    // We NEVER see the card number — Stripe handles everything.
    //
    // success_url → where Stripe redirects after successful payment
    // cancel_url  → where Stripe redirects if they click "back"
    //
    // metadata → arbitrary key/value pairs stored on the session
    //   These come back in the webhook so we know who bought what
    // ──────────────────────────────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Handpan Lesson Gift",
              description: `A gift lesson for ${cleanRecipientName}`,
            },
            unit_amount: LESSON_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      // Store everything we need for the webhook
      metadata: {
        gifter_name:      cleanGifterName,
        gifter_email:     cleanGifterEmail,
        recipient_name:   cleanRecipientName,
        recipient_email:  cleanRecipientEmail,
        message:          cleanMessage,
      },
      success_url: `${process.env.SITE_URL}/gift/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.SITE_URL}/gift`,
    });

    // Return the Stripe checkout URL — frontend will redirect there
    return ok(res, { url: session.url });

  } catch (e) {
    console.error("Stripe error:", e);
    return err(res, 500, "Could not create checkout session. Please try again.");
  }
}