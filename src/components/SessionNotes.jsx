import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function SessionNotes({ bookingId, currentUser }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef(null);

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

  // ── Step 2: Subscribe to Realtime — the WebSocket part ───────────────────
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
          // A new note was inserted — add it to state
          // This fires for BOTH users — the writer and the reader
          setNotes((prev) => {
            // Avoid duplicates — if we already have this note (from POST response)
            // don't add it again from the Realtime event
            const exists = prev.some((n) => n.id === payload.new.id);
            return exists ? prev : [...prev, payload.new];
          });
        }
      )
      .subscribe();

    // Cleanup: close the WebSocket when component unmounts
    return () => supabase.removeChannel(channel);
  }, [bookingId]);

  // ── Step 3: Auto-scroll to bottom when notes change ──────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  // ── Step 4: Save a new note ───────────────────────────────────────────────
  async function handleSave() {
    if (!text.trim() || saving) return;
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
      // Add our own note immediately from the POST response
      // Realtime will also fire for us — the duplicate check above handles it
      setNotes((prev) => [...prev, json.note]);
      setText("");
    }

    setSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading notes...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Notes thread */}
      <div style={{
        display:   "flex", flexDirection: "column", gap: 8,
        maxHeight: "320px", overflowY: "auto", padding: "4px 0"
      }}>
        {notes.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
            No notes yet. Add the first one below.
          </p>
        )}

        {notes.map((note) => {
          const isMe = note.author_id === currentUser.id;
          return (
            <div key={note.id} style={{
              alignSelf:    isMe ? "flex-end" : "flex-start",
              background:   isMe ? "var(--color-background-info)" : "var(--color-background-secondary)",
              border:       "0.5px solid var(--color-border-tertiary)",
              borderRadius: 10,
              padding:      "8px 12px",
              maxWidth:     "75%",
            }}>
              <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 3,
                color: isMe ? "var(--color-text-info)" : "var(--color-text-secondary)"
              }}>
                {note.author_role === "instructor" ? "Medya" : "You"}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>{note.content}</p>
              <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>
                {new Date(note.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
          }}
          placeholder="Write a note... (Enter to save)"
          rows={2}
          style={{ flex: 1, resize: "none", fontSize: 13 }}
        />
        <button onClick={handleSave} disabled={saving || !text.trim()}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

    </div>
  );
}