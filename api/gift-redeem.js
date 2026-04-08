// gift-redeem.js — POST /api/gift-redeem
//
// What this teaches:
//   → Looking up a record by a user-supplied value (the code)
//   → Checking multiple conditions before allowing an action
//     (exists? not expired? not already redeemed?)
//   → Updating a record's status in one atomic operation
//   → Why you check expiry on the SERVER not the frontend

import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_lib/cors.js";
import { sanitizeText } from "./_lib/sanitize.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return err(res, 405, "Method not allowed.");
  }

  // Rate limit — prevent brute forcing gift codes
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "gift-redeem", 10, 60 * 60);
  if (!allowed) {
    return err(res, 429, "Too many attempts. Please try again later.");
  }

  const raw = req.body?.code;
  const code = sanitizeText(raw, 20).toUpperCase().trim();

  if (!code) {
    return err(res, 400, "Please enter a gift code.");
  }

  try {
    // Look up the code in the database
    const { data, error } = await supabase
      .from("gift_codes")
      .select("id, status, expires_at, recipient_name, gifter_name")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error);
      return err(res, 500, "Server error. Please try again.");
    }

    // Code doesn't exist
    if (!data) {
      return err(res, 404, "Gift code not found. Please check and try again.");
    }

    // Already redeemed
    if (data.status === "redeemed") {
      return err(res, 400, "This gift code has already been redeemed.");
    }

    // Expired — check on server, never trust client-side date checks
    if (new Date(data.expires_at) < new Date()) {
      return err(res, 400, "This gift code has expired.");
    }

    // All checks passed — mark as redeemed
    const { error: updateError } = await supabase
      .from("gift_codes")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return err(res, 500, "Could not redeem code. Please try again.");
    }

    return ok(res, {
      message: "Gift code redeemed successfully!",
      code: code, // ← this line must be there
      recipient_name: data.recipient_name,
      gifter_name: data.gifter_name,
    });
  } catch (e) {
    console.error("Server error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}
