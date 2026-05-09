// src/components/SessionNotes.jsx
//
// A threaded notes panel for a single booking.
//
// PROPS
//   bookingId    — UUID of the booking these notes belong to
//   currentUser  — Supabase auth user object (we only need .id)
//   userRole     — "instructor" | "student" — controls who can post / edit
//
// RULES
//   - Instructor can ALWAYS post a new note and edit any of their own notes.
//   - Student can post a reply ONLY after the instructor has seeded the
//     thread with at least one note. Until then, the textarea is hidden.
//   - Anyone can edit a note they personally authored. Server enforces this
//     too — UI restrictions are convenience, not security.
//
// REALTIME
//   We subscribe to INSERT events on session_notes filtered by booking_id so
//   both sides see new notes appear without a refresh. UPDATE events would be
//   nice for showing edits in real time, but we keep it simple: the editor
//   updates their own state from the PATCH response, and the other side
//   sees the edit on next page load. This avoids the extra subscription and
//   matches a "save then refresh" mental model.

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function SessionNotes({ bookingId, currentUser, userRole = "student" }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const bottomRef = useRef(null);

  const isInstructor = userRole === "instructor";

  // Whether the instructor has already seeded the thread (used to gate
  // the student textarea). Recomputed on every render — cheap.
  const instructorHasSeeded = notes.some((n) => n.author_role === "instructor");
  const canPost = isInstructor || instructorHasSeeded;

  // ── Step 1: Fetch existing notes on mount ─────────────────────────────────
  useEffect(() => {
    async function fetchNotes() {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `/api/session-notes?booking_id=${bookingId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      if (json.success) setNotes(json.notes);
      setLoading(false);
    }
    fetchNotes();
  }, [bookingId]);

  // ── Step 2: Subscribe to Realtime — INSERT events only ────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`session-notes-${bookingId}`)
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
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [bookingId]);

  // ── Step 3: Auto-scroll on note changes ──────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  // ── Step 4: Save a new note ───────────────────────────────────────────────
  async function handleSave() {
    if (!text.trim() || saving || !canPost) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch("/api/session-notes", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ booking_id: bookingId, content: text.trim() }),
    });

    const json = await res.json();

    if (json.success) {
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === json.note.id);
        return exists ? prev : [...prev, json.note];
      });
      setText("");
    }

    setSaving(false);
  }

  // ── Step 5: Edit an existing note ─────────────────────────────────────────
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

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch("/api/session-notes", {
      method:  "PATCH",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id: editingId, content: editingText.trim() }),
    });

    const json = await res.json();

    if (json.success) {
      setNotes((prev) =>
        prev.map((n) => (n.id === editingId ? json.note : n))
      );
      cancelEdit();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <p className="text-xs text-forest/50">Loading notes...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Notes thread */}
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto py-1">
        {notes.length === 0 && (
          <p className="text-xs text-forest/50">
            {isInstructor
              ? "No notes yet. Add the first one below."
              : "Your instructor will leave notes after your session."}
          </p>
        )}

        {notes.map((note) => {
          const isMine = note.author_id === currentUser.id;
          const isInstructorNote = note.author_role === "instructor";
          const isEditing = editingId === note.id;

          return (
            <div
              key={note.id}
              className={`max-w-[85%] rounded-2xl border border-sand px-3 py-2 ${
                isInstructorNote
                  ? "self-start bg-sage/10"
                  : "self-end bg-orange/10"
              }`}
            >
              <p
                className={`text-xs font-bold mb-1 ${
                  isInstructorNote ? "text-sage" : "text-orange"
                }`}
              >
                {isInstructorNote ? "Medya" : isMine ? "You" : "Student"}
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
                    <p className="text-[10px] text-forest/40">
                      {new Date(note.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {note.updated_at && " · edited"}
                    </p>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => startEdit(note)}
                        className="text-[10px] font-bold text-forest/50 hover:text-orange"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area — shown to instructors always; to students only after
          the instructor has seeded the thread. */}
      {canPost ? (
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder={
              isInstructor
                ? "Write a note for the student..."
                : "Reply to your instructor..."
            }
            rows={2}
            className="flex-1 rounded-2xl border border-forest/15 bg-cream px-3 py-2 text-sm text-forest placeholder:text-forest/35 outline-none focus:border-orange resize-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="px-4 py-2 bg-forest text-cream font-bold text-sm rounded-2xl hover:bg-sage transition-colors disabled:opacity-50"
          >
            {saving ? "..." : "Send"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-forest/40 italic px-1">
          You'll be able to reply once your instructor leaves a note.
        </p>
      )}
    </div>
  );
}
