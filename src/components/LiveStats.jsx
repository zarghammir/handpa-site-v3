// ─── What this component teaches ─────────────────────────────────────────────
//
// This is a classic frontend data-fetching pattern:
//
//   1. Start with null (no data yet)
//   2. Fire a GET request to your own API on mount (useEffect + [])
//   3. While waiting → show a loading placeholder (skeleton)
//   4. On success   → render the real value
//   5. On failure   → fail silently (the stat just doesn't appear)
//
// Why fetch from /api/stats-get instead of Supabase directly?
//   The browser could technically query Supabase directly using the anon key,
//   but that exposes your DB URL and key to users. Any logic that touches
//   sensitive data or requires service-role access should always go through
//   your own API endpoint.
//
// The loading skeleton:
//   Instead of showing nothing (jarring) or a spinner (distracting), we show
//   a placeholder element with the same width/height as the content that's
//   coming. This technique is called a "skeleton screen" — it gives users a
//   sense of the page structure while content loads.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

export default function LiveStats({ type, suffix = "" }) {
  // null = loading, a number = loaded, stays null on error (silent fail)
  const [value, setValue] = useState(null);

  useEffect(() => {
    // GET /api/stats-get → { success: true, students: N, lessons: N, hours: N }
    fetch("/api/stats-get")
      .then((r) => r.json())
      .then((data) => {
        // data[type] picks the right field: "students", "lessons", or "hours"
        if (data.success) setValue(data[type]);
      })
      .catch(() => {
        // If the request fails entirely, leave value as null.
        // The stat area just won't display a number — better than crashing.
      });
  }, [type]); // re-run if the "type" prop changes (e.g. switching student → lesson count)

  // Loading state: animated pulse placeholder that matches the content size
  if (value === null) {
    return (
      <span className="inline-block w-8 h-4 bg-sand/50 rounded animate-pulse align-middle" />
    );
  }

  return (
    <span>
      {value}
      {suffix}
    </span>
  );
}
