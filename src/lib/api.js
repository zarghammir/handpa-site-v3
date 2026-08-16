// Shared helper for calling our own API routes with the Supabase JWT.
//
// Every dashboard action used to hand-roll this fetch — and none of them
// handled a dropped connection, an expired session, or a non-JSON 500, so
// buttons froze in their "saving…" state forever. This wraps all of that:
// callers always get back { ok, data, error } and never need try/catch.
import { supabase } from "./supabase";

export async function authedFetch(path, { method = "GET", body } = {}) {
  let session;
  try {
    ({ data: { session } } = await supabase.auth.getSession());
  } catch {
    session = null;
  }
  if (!session) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  try {
    const res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      // Non-JSON response (e.g. a platform 500 page) — fall through
    }

    if (!res.ok || json?.success === false) {
      return {
        ok: false,
        error: json?.error || `Request failed (${res.status}). Please try again.`,
        data: json,
      };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}
