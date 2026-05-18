// api/session.js
//
// Unified endpoint for everything inside a session/booking — notes and files.
// We merged the two so we stay under Vercel Hobby's 12-serverless-function
// cap. Each "resource" is selected by the `type` query param.
//
// ROUTES
//   ?type=notes         GET    list notes for a booking
//                       POST   create a note
//                       PATCH  edit a note (author only)
//   ?type=files         GET    list files for a booking (with signed URLs)
//                       DELETE delete a file (instructor only)
//   ?type=participants  GET    list the {full_name, avatar_url} for both
//                              parties on this booking. Goes through the
//                              service role because RLS on `profiles`
//                              prevents students from reading the
//                              instructor's profile directly — without
//                              this, the student would never see Medya's
//                              avatar in chat bubbles.
//
// Uploads happen client-side directly to Supabase Storage (storage RLS
// enforces instructor-only). That avoids Vercel's request-body size limit
// for audio/video recordings.
//
// The JWT verification + `canAccessBooking` helper are shared across both
// resource types so we don't duplicate auth logic.

import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_lib/cors.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "session-files";
const SIGNED_URL_TTL_SECONDS = 3600; // 1h — long enough to start a download

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // ── Verify JWT ──────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return err(res, 401, "Missing auth token.");
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(token);
  if (authError || !user) return err(res, 401, "Invalid or expired token.");

  // ── Route by `type` ─────────────────────────────────────────────────────
  const { type } = req.query;
  if (type === "notes")        return handleNotes(req, res, user);
  if (type === "files")        return handleFiles(req, res, user);
  if (type === "participants") return handleParticipants(req, res, user);
  return err(res, 400, "Pass ?type=notes, ?type=files, or ?type=participants");
}

// ─────────────────────────────────────────────────────────────────────────
// PARTICIPANTS
// ─────────────────────────────────────────────────────────────────────────
// Returns the instructor + student profile rows attached to a booking so
// the chat UI can render an avatar circle next to each message bubble.
// Resolved server-side because students cannot read other profiles under
// RLS — service_role bypasses that safely after we verify the caller has
// access to the booking.
async function handleParticipants(req, res, user) {
  if (req.method !== "GET") return err(res, 405, "Method not allowed.");

  const { booking_id } = req.query;
  if (!booking_id) return err(res, 400, "booking_id is required.");

  const allowed = await canAccessBooking(user, booking_id);
  if (!allowed) return err(res, 403, "You don't have access to this booking.");

  const { data: booking } = await supabase
    .from("bookings")
    .select("student_email")
    .eq("id", booking_id)
    .single();

  // Pull the instructor row by role, and the student row by the email
  // attached to the booking. Both are scoped to a single record so the
  // payload stays minimal.
  const [{ data: instructor }, { data: student }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("role", "instructor")
      .limit(1)
      .maybeSingle(),
    booking?.student_email
      ? supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role")
          .eq("email", booking.student_email)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const participants = [];
  if (instructor) participants.push(instructor);
  if (student)    participants.push(student);
  return ok(res, { participants });
}

// ─────────────────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────────────────
async function handleNotes(req, res, user) {
  if (req.method === "GET")   return getNotes(req, res, user);
  if (req.method === "POST")  return createNote(req, res, user);
  if (req.method === "PATCH") return updateNote(req, res, user);
  return err(res, 405, "Method not allowed.");
}

async function getNotes(req, res, user) {
  const { booking_id } = req.query;
  if (!booking_id) return err(res, 400, "booking_id is required.");

  const allowed = await canAccessBooking(user, booking_id);
  if (!allowed) return err(res, 403, "You don't have access to this booking.");

  const { data, error } = await supabase
    .from("session_notes")
    .select("id, author_id, author_role, content, created_at, updated_at")
    .eq("booking_id", booking_id)
    .order("created_at", { ascending: true });

  if (error) return err(res, 500, "Could not fetch notes.");
  return ok(res, { notes: data });
}

async function createNote(req, res, user) {
  const { booking_id, content } = req.body;
  if (!booking_id || !content?.trim()) {
    return err(res, 400, "booking_id and content are required.");
  }

  const allowed = await canAccessBooking(user, booking_id);
  if (!allowed) return err(res, 403, "You don't have access to this booking.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const author_role = profile?.role === "instructor" ? "instructor" : "student";

  // Seeding rule: students can only post AFTER an instructor has contributed
  // (a note OR a file). Lets the student reply once the conversation has
  // been opened by Medya, but never seed it themselves.
  if (author_role === "student") {
    const [{ count: instructorNoteCount }, { count: fileCount }] =
      await Promise.all([
        supabase
          .from("session_notes")
          .select("*", { count: "exact", head: true })
          .eq("booking_id", booking_id)
          .eq("author_role", "instructor"),
        supabase
          .from("session_files")
          .select("*", { count: "exact", head: true })
          .eq("booking_id", booking_id),
      ]);

    if (!instructorNoteCount && !fileCount) {
      return err(
        res,
        403,
        "You can only reply once your instructor has added something."
      );
    }
  }

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
  return ok(res, { note: data }, 201);
}

async function updateNote(req, res, user) {
  const { id, content } = req.body;
  if (!id || !content?.trim()) {
    return err(res, 400, "id and content are required.");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("session_notes")
    .select("id, author_id")
    .eq("id", id)
    .single();
  if (fetchError || !existing) return err(res, 404, "Note not found.");
  if (existing.author_id !== user.id) {
    return err(res, 403, "You can only edit your own notes.");
  }

  const { data, error } = await supabase
    .from("session_notes")
    .update({
      content:    content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return err(res, 500, "Could not update note.");
  return ok(res, { note: data });
}

// ─────────────────────────────────────────────────────────────────────────
// FILES
// ─────────────────────────────────────────────────────────────────────────
async function handleFiles(req, res, user) {
  if (req.method === "GET")    return listFiles(req, res, user);
  if (req.method === "DELETE") return deleteFile(req, res, user);
  return err(res, 405, "Method not allowed.");
}

async function listFiles(req, res, user) {
  const { booking_id } = req.query;
  if (!booking_id) return err(res, 400, "booking_id is required.");

  const allowed = await canAccessBooking(user, booking_id);
  if (!allowed) return err(res, 403, "You don't have access to this booking.");

  const { data: rows, error } = await supabase
    .from("session_files")
    .select("id, file_path, file_name, file_size, mime_type, uploaded_at, uploader_id")
    .eq("booking_id", booking_id)
    .order("uploaded_at", { ascending: false });

  if (error) return err(res, 500, "Could not fetch files.");

  // Mint a signed URL per file so the bucket can stay private.
  const files = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return ok(res, { files });
}

async function deleteFile(req, res, user) {
  const { id } = req.query;
  if (!id) return err(res, 400, "id is required.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "instructor") return err(res, 403, "Instructor only.");

  const { data: row, error: fetchError } = await supabase
    .from("session_files")
    .select("id, file_path")
    .eq("id", id)
    .single();
  if (fetchError || !row) return err(res, 404, "File not found.");

  // Storage first; if that fails we keep the row so a retry can finish.
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([row.file_path]);
  if (storageError) {
    console.warn("Storage delete failed:", storageError.message);
    return err(res, 500, "Could not delete file from storage.");
  }

  const { error: dbError } = await supabase
    .from("session_files")
    .delete()
    .eq("id", id);
  if (dbError) return err(res, 500, "Could not delete metadata row.");
  return ok(res, { id });
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────────────
async function canAccessBooking(user, booking_id) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "instructor") return true;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", booking_id)
    .eq("student_email", user.email)
    .single();
  return !!booking;
}
