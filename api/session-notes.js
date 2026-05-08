import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_lib/cors.js";
import { ok, err } from "./_lib/response.js";

// Service role client — used for trusted server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // ── Verify the JWT from the Authorization header ──────────────────────────
  // The frontend sends: Authorization: Bearer <supabase_access_token>
  // We verify it server-side so we know exactly who is making the request
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return err(res, 401, "Missing auth token.");
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return err(res, 401, "Invalid or expired token.");
  }

  // ── Route to GET or POST handler ──────────────────────────────────────────
  if (req.method === "GET")  return getNotes(req, res, user);
  if (req.method === "POST") return createNote(req, res, user);

  return err(res, 405, "Method not allowed.");
}

// ── GET /api/session-notes?booking_id=xxx ─────────────────────────────────
// Loads all existing notes for a booking when the notes panel opens
async function getNotes(req, res, user) {
  const { booking_id } = req.query;

  if (!booking_id) {
    return err(res, 400, "booking_id is required.");
  }

  // Verify this user is allowed to read notes for this booking
  const allowed = await canAccessBooking(user, booking_id);
  if (!allowed) {
    return err(res, 403, "You don't have access to this booking.");
  }

  const { data, error } = await supabase
    .from("session_notes")
    .select("id, author_id, author_role, content, created_at")
    .eq("booking_id", booking_id)
    .order("created_at", { ascending: true });

  if (error) return err(res, 500, "Could not fetch notes.");

  return ok(res, { notes: data });
}

// ── POST /api/session-notes ───────────────────────────────────────────────
// Saves a new note — Realtime broadcasts it to all subscribers automatically
async function createNote(req, res, user) {
  const { booking_id, content } = req.body;

  if (!booking_id || !content?.trim()) {
    return err(res, 400, "booking_id and content are required.");
  }

  // Verify this user is allowed to write notes for this booking
  const allowed = await canAccessBooking(user, booking_id);
  if (!allowed) {
    return err(res, 403, "You don't have access to this booking.");
  }

  // Look up this user's role from the profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const author_role = profile?.role === "instructor" ? "instructor" : "student";

  const { data, error } = await supabase
    .from("session_notes")
    .insert({
      booking_id,
      author_id:   user.id,
      author_role,
      content:     content.trim(),
    })
    .select()
    .single();

  if (error) return err(res, 500, "Could not save note.");

  // Return the new note — frontend can use this for optimistic update
  return ok(res, { note: data }, 201);
}

// ── Shared access check ───────────────────────────────────────────────────
// Instructors can access any booking. Students only their own.
async function canAccessBooking(user, booking_id) {
  // Check if instructor
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "instructor") return true;

  // For students — check the booking belongs to them
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", booking_id)
    .eq("student_email", user.email)
    .single();

  return !!booking;
}