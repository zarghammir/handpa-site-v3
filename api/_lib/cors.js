// ─── What is CORS? ───────────────────────────────────────────────────────────
//
// CORS stands for Cross-Origin Resource Sharing. Browsers enforce a rule called
// the "same-origin policy": JavaScript on site A is not allowed to make requests
// to site B by default. CORS is the mechanism that lets you relax that rule in a
// controlled way.
//
// How it works:
//
//  1. Browser wants to POST to /api/contact from your frontend
//  2. If the frontend and API are on different origins (different domain/port),
//     the browser first sends an "OPTIONS preflight" request asking:
//     "Are you willing to accept a POST from this origin?"
//  3. If the server responds with the right headers, the browser proceeds.
//     If not, the browser blocks the request (even if the server processed it).
//
// The key response headers:
//   Access-Control-Allow-Origin  → which origins are allowed (never use * in prod)
//   Access-Control-Allow-Methods → which HTTP methods are allowed
//   Access-Control-Allow-Headers → which request headers are allowed
//
// Why not just use *?
//   Allowing all origins means any website can call your API.
//   Locking it to your production URL means only your frontend can.
// ─────────────────────────────────────────────────────────────────────────────

// In development (SITE_URL is not set) we fall back to the Vite dev server.
const ALLOWED_ORIGIN = process.env.SITE_URL ?? "http://localhost:5173";

/**
 * Applies CORS headers to every response and handles the OPTIONS preflight.
 *
 * Returns true if this was a preflight request (caller should return early).
 * Returns false for normal requests (caller should continue handling them).
 *
 * Usage at the top of every API handler:
 *   if (handleCors(req, res)) return;
 */
export function handleCors(req, res) {
  // Tell the browser which origin is allowed to call this endpoint
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);

  // Tell the browser which HTTP methods are allowed
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  // Tell the browser which request headers the client can send
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONS = preflight check. Respond with 204 No Content and stop.
  // The browser will then send the real request.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // signal to caller: stop here, preflight is handled
  }

  return false; // signal to caller: continue with the real request logic
}
