// ─── Why standardize API responses? ──────────────────────────────────────────
//
// Every HTTP response has two parts:
//   1. A status code  (e.g. 200, 400, 500)
//   2. A body         (usually JSON)
//
// Without a shared helper, each endpoint ends up with slightly different shapes:
//   { message: "ok" }          ← one endpoint
//   { success: true, data: … } ← another endpoint
//   { error: "bad" }           ← yet another
//
// This makes the frontend harder to write because it can't rely on a consistent
// shape. Standardizing means the frontend can always check `data.success` and
// always find error messages at `data.message`.
//
// HTTP status codes to know:
//   200 → OK — request succeeded
//   400 → Bad Request — the client sent invalid data
//   405 → Method Not Allowed — wrong HTTP method (e.g. GET on a POST-only route)
//   429 → Too Many Requests — rate limit exceeded
//   500 → Internal Server Error — something broke on the server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a successful 200 response.
 * Spreads any extra data alongside { success: true }.
 *
 * Example:
 *   ok(res, { message: "Sent!", testimonials: [] })
 *   // → 200  { success: true, message: "Sent!", testimonials: [] }
 */
export const ok = (res, data = {}) =>
  res.status(200).json({ success: true, ...data });

/**
 * Send an error response with a given HTTP status code and message.
 *
 * Example:
 *   err(res, 400, "Email is required.")
 *   // → 400  { success: false, message: "Email is required." }
 */
export const err = (res, status, message) =>
  res.status(status).json({ success: false, message });
