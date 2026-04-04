// ─── What is rate limiting and why does it matter? ───────────────────────────
//
// A rate limiter restricts how many times a client (identified by their IP
// address) can call an endpoint within a time window.
//
// Without it, anyone can write a script like:
//   while (true) { fetch('/api/contact', { method: 'POST', body: ... }) }
//
// This would:
//   → Exhaust your Resend free tier (100 emails/day) in seconds
//   → Flood Medya's inbox
//   → Potentially cost money if you're on a paid tier
//
// The algorithm used here is "fixed window counter":
//   1. Each request gets a key:  "route:ip"  (e.g. "contact:1.2.3.4")
//   2. On first request: create a row in the DB with count=1 and a window_end
//      timestamp (e.g. 1 hour from now)
//   3. On subsequent requests within the window: increment the count
//   4. If count exceeds max: reject with 429 Too Many Requests
//   5. After window_end: reset (create a fresh row on the next request)
//
// Why use Supabase as the store?
//   Rate limiters need to share state across all server instances.
//   Vercel can spin up multiple instances of your function simultaneously,
//   so an in-memory Map() wouldn't work — each instance has its own memory.
//   Supabase (PostgreSQL) is a central store that all instances can read/write.
//
// Before this works you must run this SQL in your Supabase dashboard:
//   supabase/migrations/001_rate_limits.sql
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

// We use the service role key here because rate_limits is an internal table
// that the browser should never access directly.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Checks whether a given IP has exceeded the rate limit for a route.
 *
 * @param {string} ip      - The client's IP address (from request headers)
 * @param {string} route   - Short name for the endpoint, e.g. "contact"
 * @param {number} max     - Maximum requests allowed in the window
 * @param {number} windowS - Window duration in seconds (e.g. 3600 = 1 hour)
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(ip, route, max, windowS) {
  // The key uniquely identifies this (route, IP) pair in the database.
  // Using a composite key means limits are per-endpoint, not site-wide.
  const key = `${route}:${ip}`;
  const now = new Date();

  // Look up the current record for this key
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, count, window_end")
    .eq("key", key)
    .maybeSingle(); // returns null instead of error if not found

  // Case 1: No record yet, or the previous window has expired → start fresh
  if (!existing || new Date(existing.window_end) < now) {
    const windowEnd = new Date(now.getTime() + windowS * 1000).toISOString();

    // upsert = insert if not exists, update if exists (based on "key" column)
    await supabase
      .from("rate_limits")
      .upsert({ key, count: 1, window_end: windowEnd }, { onConflict: "key" });

    return { allowed: true, remaining: max - 1 };
  }

  // Case 2: Window is active and limit has been reached → reject
  if (existing.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  // Case 3: Window is active and limit not yet reached → increment and allow
  await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("id", existing.id);

  return { allowed: true, remaining: max - existing.count - 1 };
}

/**
 * Extracts the real client IP from the request.
 *
 * Why not just use req.socket.remoteAddress?
 *   On Vercel (and most cloud platforms), your function sits behind a load
 *   balancer / CDN. The "remote address" is always the load balancer's IP,
 *   not the actual user. The real client IP is forwarded in the
 *   X-Forwarded-For header instead.
 *
 *   Format: "client, proxy1, proxy2"  → we take the first (leftmost) value.
 */
export function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}
