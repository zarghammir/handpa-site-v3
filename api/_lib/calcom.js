// api/_lib/calcom.js
//
// Tiny client for cal.com's v2 booking endpoints.
//
// AUTH
//   `Authorization: Bearer <CAL_API_KEY>` — same key whether it came from a
//   cal.com personal API key, a managed-user access token, or OAuth.
//
// VERSION HEADER
//   Cal.com pins v2 endpoints to a date string. Without this header, you get
//   a *previous* version of the endpoint — fragile silent breakage.
//
// FAILURE PHILOSOPHY
//   When sync to cal.com fails (network, 4xx, 5xx) we never throw. The caller
//   continues with its primary operation (DB update + email) and we return
//   `{ ok: false, error }` so the caller can log/notify. This avoids the
//   worst case where our DB and cal.com disagree silently AND the user sees
//   an error they can't act on.

const BASE = "https://api.cal.com/v2";
const CAL_API_VERSION = "2026-02-25";

function authHeaders() {
  const key = process.env.CAL_API_KEY;
  if (!key) {
    return null; // Caller checks for null and skips the call gracefully.
  }
  return {
    Authorization: `Bearer ${key}`,
    "cal-api-version": CAL_API_VERSION,
    "Content-Type": "application/json",
  };
}

// Cancel a confirmed booking on cal.com.
// Returns { ok: true } on 2xx, otherwise { ok: false, status, error }.
export async function cancelCalBooking(bookingUid, reason = "") {
  if (!bookingUid) return { ok: false, error: "no bookingUid" };
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "CAL_API_KEY missing" };

  try {
    const resp = await fetch(`${BASE}/bookings/${bookingUid}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ cancellationReason: reason || "Cancelled by instructor" }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(
        `cal.com cancel failed [${resp.status}] for ${bookingUid}: ${text}`
      );
      return { ok: false, status: resp.status, error: text };
    }
    return { ok: true };
  } catch (e) {
    console.warn("cal.com cancel network error:", e?.message);
    return { ok: false, error: e?.message ?? "network error" };
  }
}

// Approve a pending booking on cal.com (used by event types with
// "Requires booking confirmation" enabled).
export async function confirmCalBooking(bookingUid) {
  if (!bookingUid) return { ok: false, error: "no bookingUid" };
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "CAL_API_KEY missing" };

  try {
    const resp = await fetch(`${BASE}/bookings/${bookingUid}/confirm`, {
      method: "POST",
      headers,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(
        `cal.com confirm failed [${resp.status}] for ${bookingUid}: ${text}`
      );
      return { ok: false, status: resp.status, error: text };
    }
    return { ok: true };
  } catch (e) {
    console.warn("cal.com confirm network error:", e?.message);
    return { ok: false, error: e?.message ?? "network error" };
  }
}
