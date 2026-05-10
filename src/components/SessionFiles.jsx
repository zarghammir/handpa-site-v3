// src/components/SessionFiles.jsx
//
// File attachments for a booking — instructor uploads, both can download.
//
// PROPS
//   bookingId — UUID of the booking
//   userRole  — "instructor" | "student"
//
// HOW UPLOAD WORKS
//   The instructor's browser uploads directly to Supabase Storage using the
//   anon client + their session JWT. Storage RLS allows INSERT for instructors
//   in the `session-files` bucket. After the upload succeeds we insert a row
//   into `session_files` so the file shows up for everyone with access.
//
//   We upload directly to storage (rather than POST to our /api endpoint) to
//   sidestep Vercel's serverless function body size limits — a 60-min audio
//   recording can be tens of MB.
//
// HOW DOWNLOAD WORKS
//   The list endpoint returns a short-lived signed URL per file. Clicking
//   the file opens that URL in a new tab. URLs expire after ~1h; if the
//   user keeps the panel open longer than that, a refresh re-fetches.

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const BUCKET = "session-files";

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Make a filename safe for a storage path. We keep the extension but strip
// anything that would confuse URL parsing (spaces, slashes, etc.).
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function SessionFiles({ bookingId, userRole = "student" }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const isInstructor = userRole === "instructor";

  // ── Load file list ──────────────────────────────────────────────────────
  async function refresh() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(
        `/api/session-files?booking_id=${bookingId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      if (json.success) setFiles(json.files);
      else setError(json.error || "Could not load files.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Upload (instructor only) ────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !isInstructor) return;

    setError(null);
    setUploading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in.");
      setUploading(false);
      return;
    }

    // Build a unique storage path under the booking. The leading bookingId
    // segment makes it easy to spot orphans later if we ever clean up.
    const safeName = sanitizeName(file.name);
    const storagePath = `${bookingId}/${crypto.randomUUID()}-${safeName}`;

    // Upload directly to storage. The user's JWT carries their auth so RLS
    // sees them as an instructor.
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setError(uploadError.message || "Upload failed.");
      setUploading(false);
      return;
    }

    // Record metadata. If this fails the storage object becomes orphaned —
    // not catastrophic, can be cleaned up later.
    const { error: metaError } = await supabase.from("session_files").insert({
      booking_id:  bookingId,
      uploader_id: session.user.id,
      file_path:   storagePath,
      file_name:   file.name,
      file_size:   file.size,
      mime_type:   file.type || null,
    });

    if (metaError) {
      console.error("Metadata insert error:", metaError);
      setError(metaError.message || "Saved file, but metadata insert failed.");
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refresh();
  }

  // ── Delete (instructor only) ────────────────────────────────────────────
  async function handleDelete(id) {
    if (!isInstructor) return;
    if (!confirm("Delete this file?")) return;

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/session-files?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    if (json.success) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } else {
      setError(json.error || "Could not delete.");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {loading && <p className="text-xs text-forest/50">Loading files...</p>}

      {!loading && files.length === 0 && (
        <p className="text-xs text-forest/50">
          {isInstructor
            ? "No files yet. Upload sheet music, recordings, or anything else for this session."
            : "Your instructor hasn't uploaded any files for this session yet."}
        </p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-sand bg-cream/50 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <a
                  href={f.signed_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-forest hover:text-orange truncate block"
                  title={f.file_name}
                >
                  {f.file_name}
                </a>
                <p className="text-[11px] text-forest/50">
                  {formatBytes(f.file_size)} · {formatDate(f.uploaded_at)}
                </p>
              </div>
              {isInstructor && (
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  className="text-[11px] font-bold text-forest/40 hover:text-red-500 px-2"
                  aria-label="Delete file"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Upload control — instructor only */}
      {isInstructor && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-xs text-forest/70
                       file:mr-3 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-xs file:font-bold
                       file:bg-forest file:text-cream
                       hover:file:bg-sage
                       file:cursor-pointer"
          />
          {uploading && (
            <p className="text-xs text-forest/50 mt-2">Uploading...</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
