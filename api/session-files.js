// api/session-files.js
//
// Lists files for a booking and produces short-lived signed URLs the client
// can use to download. Also handles deletion (instructor only).
//
// Why a server endpoint instead of letting the client read storage directly?
//   The bucket is private. We don't add a SELECT RLS policy on storage.objects
//   because the right scope ("authenticated user can read files attached to
//   bookings they're a party to") is awkward to express in storage RLS.
//   Easier to authorize once here and produce signed URLs.
//
// Uploads happen client-side directly to Supabase Storage (storage RLS allows
// instructors to INSERT into this bucket). That avoids Vercel function body
// size limits, which would break audio/video uploads.

import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_lib/cors.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "session-files";
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour — long enough to start a download

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return err(res, 401, "Missing auth token.");
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(token);
  if (authError || !user) return err(res, 401, "Invalid or expired token.");

  if (req.method === "GET")    return listFiles(req, res, user);
  if (req.method === "DELETE") return deleteFile(req, res, user);
  return err(res, 405, "Method not allowed.");
}

// ── GET /api/session-files?booking_id=xxx ────────────────────────────────
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

  // Generate a signed URL per file. We do this server-side so we don't have
  // to grant SELECT on storage.objects to all authenticated users.
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

// ── DELETE /api/session-files?id=xxx ─────────────────────────────────────
// Instructor only. Removes the storage object + the metadata row.
async function deleteFile(req, res, user) {
  const { id } = req.query;
  if (!id) return err(res, 400, "id is required.");

  // Only instructors can delete
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "instructor") {
    return err(res, 403, "Instructor only.");
  }

  // Look up the row so we know the storage path
  const { data: row, error: fetchError } = await supabase
    .from("session_files")
    .select("id, file_path, uploader_id")
    .eq("id", id)
    .single();

  if (fetchError || !row) return err(res, 404, "File not found.");

  // Delete storage object first; if that fails, we keep the metadata row so
  // a retry can finish the job.
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

// ── Shared access check ──────────────────────────────────────────────────
// Mirrors the rule in api/session-notes.js: instructors can access any
// booking; students only their own (matched by email).
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
