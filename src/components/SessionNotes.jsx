// src/components/SessionNotes.jsx
//
// A unified session thread: notes AND file attachments mixed chronologically.
//
// PROPS
//   bookingId    — UUID of the booking these notes belong to
//   currentUser  — Supabase auth user object (we only need .id)
//   userRole     — "instructor" | "student" — controls who can post / edit /
//                  upload
//
// RULES
//   - Instructor can ALWAYS post text or upload files; can edit / delete
//     their own contributions.
//   - Student can post a text reply ONLY after the instructor has seeded the
//     thread with a note OR a file. Students cannot upload files.
//   - Anyone can edit a TEXT note they personally authored (server enforces).
//
// REALTIME
//   We subscribe to INSERT events on both `session_notes` and `session_files`
//   filtered by booking_id, so both sides see new items appear live.

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { authedFetch } from "../lib/api";

const BUCKET = "session-files";

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeStr(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function SessionNotes({ bookingId, currentUser, userRole = "student", onThreadChange }) {
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  // id → { full_name, avatar_url } for everyone who has contributed to this
  // thread. We hydrate it from `profiles` so chat bubbles can show a small
  // avatar circle next to each message.
  const [profilesById, setProfilesById] = useState({});
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const isInstructor = userRole === "instructor";

  // Seeding rule — student can reply only once the instructor has put
  // *something* in the thread (a note or a file).
  const instructorHasSeeded =
    notes.some((n) => n.author_role === "instructor") || files.length > 0;
  const canPost = isInstructor || instructorHasSeeded;

  // ── Step 1: Fetch notes + files ──────────────────────────────────────────
  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [notesRes, filesRes] = await Promise.all([
        fetch(`/api/session?type=notes&booking_id=${bookingId}`, { headers }),
        fetch(`/api/session?type=files&booking_id=${bookingId}`, { headers }),
      ]);
      const notesJson = await notesRes.json();
      const filesJson = await filesRes.json();
      if (notesJson.success) setNotes(notesJson.notes);
      if (filesJson.success) setFiles(filesJson.files);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Hydrate avatars/names for the two participants on this booking. We hit
  // the server endpoint (service_role) instead of querying `profiles`
  // directly because RLS hides the instructor's row from students — without
  // this round-trip the student would never see Medya's photo in chat.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(
          `/api/session?type=participants&booking_id=${bookingId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const json = await res.json();
        if (cancelled || !json.success || !Array.isArray(json.participants)) return;
        setProfilesById((prev) => {
          const next = { ...prev };
          for (const p of json.participants) {
            if (p?.id) next[p.id] = p;
          }
          return next;
        });
      } catch {
        // Non-fatal — bubbles will just render with initials.
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  // ── Step 2: Realtime — subscribe to INSERT on both tables ────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`session-thread-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "session_notes",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setNotes((prev) => {
            const exists = prev.some((n) => n.id === payload.new.id);
            return exists ? prev : [...prev, payload.new];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "session_files",
          filter: `booking_id=eq.${bookingId}`,
        },
        () => {
          // The realtime payload has no signed URL, and we'd need to mint one
          // to render the link. Just refetch the file list — it's small.
          loadAll();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ── Step 3: Auto-scroll on changes ───────────────────────────────────────
  useEffect(() => {
    // block:"nearest" scrolls the notes thread itself without yanking the
    // page viewport every time a card is opened mid-page.
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [notes, files]);

  // ── Step 4: Save a new text note ─────────────────────────────────────────
  async function handleSaveText() {
    if (!text.trim() || saving || !canPost) return;
    setSaving(true);
    setError(null);

    const result = await authedFetch("/api/session?type=notes", {
      method: "POST",
      body: { booking_id: bookingId, content: text.trim() },
    });

    if (result.ok) {
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === result.data.note.id);
        return exists ? prev : [...prev, result.data.note];
      });
      setText("");
      onThreadChange?.("note");
    } else {
      setError(result.error);
    }
    setSaving(false);
  }

  // ── Step 5: Upload a file (instructor only) ──────────────────────────────
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

    const safeName = sanitizeFilename(file.name);
    const storagePath = `${bookingId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message || "Upload failed.");
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const { error: metaError } = await supabase.from("session_files").insert({
      booking_id:  bookingId,
      uploader_id: session.user.id,
      file_path:   storagePath,
      file_name:   file.name,
      file_size:   file.size,
      mime_type:   file.type || null,
    });

    if (metaError) {
      setError(metaError.message || "Upload saved, but metadata failed.");
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadAll();
  }

  // ── Step 6: Edit / delete helpers ────────────────────────────────────────
  function startEdit(note) {
    setEditingId(note.id);
    setEditingText(note.content);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }
  async function saveEdit() {
    if (!editingText.trim()) return;
    const result = await authedFetch("/api/session?type=notes", {
      method: "PATCH",
      body: { id: editingId, content: editingText.trim() },
    });
    if (result.ok) {
      setNotes((prev) => prev.map((n) => (n.id === editingId ? result.data.note : n)));
      cancelEdit();
    } else {
      // Failures used to vanish silently and the edit just didn't stick.
      setError(result.error);
    }
  }

  async function deleteFile(id) {
    if (!isInstructor) return;
    if (!confirm("Delete this file?")) return;
    const result = await authedFetch(`/api/session?type=files&id=${id}`, {
      method: "DELETE",
    });
    if (result.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } else {
      setError(result.error);
    }
  }

  // ── Step 7: Merge into a single chronological feed ───────────────────────
  // Notes use `created_at`; files use `uploaded_at`. We unify under sortKey.
  const items = [
    ...notes.map((n) => ({
      kind: "note",
      id: n.id,
      sortKey: new Date(n.created_at).getTime(),
      data: n,
    })),
    ...files.map((f) => ({
      kind: "file",
      id: f.id,
      sortKey: new Date(f.uploaded_at).getTime(),
      data: f,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return <p className="text-xs text-forest/70">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Thread */}
      <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto py-1 pr-1">
        {items.length === 0 && (
          <p className="text-xs text-forest/70">
            {isInstructor
              ? "Empty thread. Send a message or upload a file to start."
              : "Your instructor hasn't added anything yet."}
          </p>
        )}

        {items.map((item) =>
          item.kind === "note"
            ? renderNote(item.data)
            : renderFile(item.data)
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row — text + attach */}
      {canPost ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            {isInstructor && (
              <label
                className="shrink-0 w-[42px] h-[42px] grid place-items-center rounded-full bg-white border-[1.5px] border-forest/15 text-forest/60 hover:text-orange hover:border-orange/50 cursor-pointer transition-colors"
                title="Attach a file"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[17px] h-[17px]">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveText();
                }
              }}
              placeholder={
                isInstructor
                  ? "Write a note for the student…"
                  : "Write to Medya…"
              }
              rows={1}
              className="flex-1 rounded-3xl border-[1.5px] border-forest/12 bg-white px-4 py-2.5 text-[14.5px] text-forest placeholder:text-forest/70 outline-none focus:border-sage resize-none caret-orange transition-colors"
            />
            <button
              type="button"
              onClick={handleSaveText}
              disabled={saving || !text.trim()}
              aria-label="Send"
              className="shrink-0 w-[42px] h-[42px] grid place-items-center rounded-full bg-forest text-cream hover:bg-sage transition-colors disabled:opacity-40"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[17px] h-[17px]">
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              )}
            </button>
          </div>
          {isInstructor && uploading && (
            <span className="text-xs text-forest/70 px-1">Uploading…</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-forest/70 italic px-1">
          You'll be able to reply once your instructor adds something.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );

  // ── Inline render helpers ────────────────────────────────────────────────
  function renderAvatar(authorId, fallbackName) {
    // Small (28px) circle that sits beside each chat bubble. Falls back to
    // the first initial of the author's name when they haven't uploaded a
    // photo yet, mirroring the style we use elsewhere on the dashboard.
    const prof = authorId ? profilesById[authorId] : null;
    const name = prof?.full_name || fallbackName || "";
    const initial = (name?.[0] || "?").toUpperCase();
    return (
      <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden bg-sand flex items-center justify-center text-forest text-[11px] font-bold">
        {prof?.avatar_url ? (
          <img
            src={prof.avatar_url}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
    );
  }

  function renderNote(note) {
    const isMine = note.author_id === currentUser.id;
    const isInstructorNote = note.author_role === "instructor";
    const isEditing = editingId === note.id;
    const fallbackName = isInstructorNote ? "Medya" : "Student";

    const bubble = (
      <div
        className={`max-w-[85%] px-3.5 py-2.5 shadow-[0_3px_10px_-4px_rgba(45,59,31,0.14)] ${
          isMine
            ? "bg-[#F0EAD8] border border-sage/40 rounded-[18px_4px_18px_18px]"
            : "bg-white border border-forest/10 rounded-[4px_18px_18px_18px]"
        }`}
      >
        <p
          className={`text-xs font-extrabold mb-0.5 ${
            isMine ? "text-forest/70" : "text-[#5F6F49]"
          }`}
        >
          {isMine ? "You" : isInstructorNote ? "Medya" : "Student"}
        </p>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest outline-none focus:border-orange"
            />
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={saveEdit}
                className="px-3 py-1 bg-forest text-cream font-bold rounded-lg hover:bg-sage transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-1 text-forest/60 hover:text-forest"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-forest leading-snug whitespace-pre-wrap">
              {note.content}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] font-semibold text-forest/70">
                {timeStr(note.created_at)}
                {note.updated_at && " · edited"}
              </p>
              {isMine && (
                <button
                  type="button"
                  onClick={() => startEdit(note)}
                  className="text-[10px] font-bold text-forest/70 hover:text-orange"
                >
                  Edit
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );

    // Instructor bubbles sit on the left with the avatar to the left of the
    // bubble; student bubbles mirror on the right.
    return (
      <div
        key={`note-${note.id}`}
        className={`flex items-start gap-2 ${
          isMine ? "self-end flex-row-reverse" : "self-start flex-row"
        } max-w-[95%]`}
      >
        {!isMine && renderAvatar(note.author_id, fallbackName)}
        {bubble}
      </div>
    );
  }

  function renderFile(file) {
    // All file uploads are from the instructor (students can't upload), so
    // the bubble always sits on the instructor (left) side.
    const showDelete = isInstructor;

    const bubble = (
      <div className="max-w-[85%] rounded-[4px_18px_18px_18px] border border-forest/10 bg-white px-3.5 py-2.5 shadow-[0_3px_10px_-4px_rgba(45,59,31,0.14)]">
        <p className="text-xs font-extrabold mb-1 text-[#5F6F49]">Medya</p>

        <a
          href={file.signed_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2.5 rounded-xl bg-cream border border-forest/10 py-2 pl-2 pr-3.5 hover:border-sage hover:-translate-y-px transition-all"
        >
          <span className="w-[30px] h-[30px] shrink-0 grid place-items-center rounded-[9px] bg-sand">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2D3B1F" strokeWidth="2" strokeLinecap="round" className="w-[15px] h-[15px]">
              <path d="M9 18V6l10-2v11" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="15" r="2.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-forest truncate" title={file.file_name}>
              {file.file_name}
            </p>
            <p className="text-[11px] text-forest/70 font-semibold">
              {formatBytes(file.file_size)} · tap to open
            </p>
          </div>
        </a>

        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] font-semibold text-forest/70">
            {timeStr(file.uploaded_at)}
          </p>
          {showDelete && (
            <button
              type="button"
              onClick={() => deleteFile(file.id)}
              className="text-[10px] font-bold text-forest/70 hover:text-red-500"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );

    return (
      <div
        key={`file-${file.id}`}
        className="flex items-start gap-2 self-start max-w-[95%]"
      >
        {renderAvatar(file.uploader_id, "Medya")}
        {bubble}
      </div>
    );
  }
}
