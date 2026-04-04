// ─── What this file teaches ──────────────────────────────────────────────────
//
// This is a GET endpoint — it reads data from the database and returns it.
// Compare this to contact.js or student-intake.js which are POST endpoints
// that write data. Most full-stack apps use both:
//
//   GET  /api/something    → read data, return JSON
//   POST /api/something    → receive data, validate, write to DB
//
// New concept: server-side caching
//   Every time the homepage loads, it calls this endpoint to show live stats.
//   If 100 people visit the site simultaneously, that's 100 Supabase queries
//   per second — wasteful for stats that only change a few times a day.
//
//   Solution: cache the result in memory for 5 minutes.
//   The first request hits the DB. The next 299 requests in that window
//   get the cached result instantly with zero DB calls.
//
//   Trade-off: stats can be up to 5 minutes stale — acceptable here.
//   Cache-Control header tells the browser (and CDN) the same thing.
//
// New concept: Supabase count queries
//   Instead of fetching all rows and counting in JS (slow, uses bandwidth),
//   we ask Postgres to count for us:
//     .select("id", { count: "exact", head: true })
//   head: true means "don't return rows, just the count" — like SELECT COUNT(*)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_lib/cors.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Module-level cache — persists across requests in the same warm function instance.
// This is intentionally simple. For multi-instance reliability, use Redis or
// Vercel's Edge Cache instead.
let cache = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "GET") {
    return err(res, 405, "Method not allowed.");
  }

  // Serve cached result if it's still fresh — skip the DB entirely
  if (cache && Date.now() < cacheExpiry) {
    // Cache-Control tells the browser and any CDN to also cache for 5 minutes
    res.setHeader("Cache-Control", "public, max-age=300");
    return ok(res, cache);
  }

  try {
    // COUNT(*) on the bookings table — returns a number, not rows
    // head: true = "don't send row data, just the aggregate"
    const { count: studentCount, error: studentError } = await supabase
      .from("bookings")
      .select("student_email", { count: "exact", head: true });

    const { count: lessonCount, error: lessonError } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true });

    if (studentError || lessonError) {
      console.error("Supabase stats error:", studentError ?? lessonError);
      return err(res, 500, "Could not fetch stats.");
    }

    const students = studentCount ?? 0;
    const lessons = lessonCount ?? 0;
    const hours = lessons; // each booking is roughly 1 hour

    const stats = { students, lessons, hours };

    // Store in memory with an expiry timestamp
    cache = stats;
    cacheExpiry = Date.now() + CACHE_TTL_MS;

    res.setHeader("Cache-Control", "public, max-age=300");
    return ok(res, stats);
  } catch (e) {
    console.error("Server error:", e);
    return err(res, 500, "Server error.");
  }
}
