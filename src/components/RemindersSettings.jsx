// src/components/RemindersSettings.jsx
//
// The "Reminders" tab inside the Instructor Dashboard. Lets Medya:
//   • toggle the reminder feature on/off
//   • change how many hours before a session the reminder fires (1–72)
//   • edit the email subject + body templates with {{placeholder}} support
//   • see a live preview as she types (rendered client-side with sample data)
//   • send a test email to herself to check the real rendered output
//
// All persistence happens via `/api/bookings?action=reminder-settings`
// (merged into bookings.js because the Hobby plan caps us at 12 functions).

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

// Placeholder reference — also acts as documentation for Medya. The same
// substitutions happen server-side in api/bookings.js so what you see here
// is what students get.
const PLACEHOLDERS = [
  { token: "{{student_name}}", desc: "Student's first name (from cal.com)" },
  { token: "{{session_date}}", desc: 'e.g. "Tuesday, March 4"' },
  { token: "{{session_time}}", desc: 'e.g. "3:00 PM"' },
  { token: "{{hours_until}}", desc: "Actual hours until the session starts" },
  { token: "{{instructor_name}}", desc: "Your name from your profile" },
  { token: "{{event_type}}", desc: 'e.g. "60-min handpan lesson"' },
];

// Client-side mirror of the server's renderTemplate. We keep the two in sync
// by using the same regex semantics — unknown placeholders are left intact.
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match
  );
}

// Sample data used for the preview pane. Matches the shape the cron uses.
function buildPreviewVars(offsetHours) {
  const start = new Date(Date.now() + offsetHours * 3_600_000);
  return {
    student_name: "Alex",
    session_date: start.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    session_time: start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    instructor_name: "Medya",
    hours_until: offsetHours,
    event_type: "60-min handpan lesson",
  };
}

export default function RemindersSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state — initialized after the GET completes.
  const [enabled, setEnabled] = useState(true);
  const [offset, setOffset] = useState(12);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // ── Load current settings on mount ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/bookings?action=reminder-settings", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success && json.settings) {
        setEnabled(json.settings.enabled);
        setOffset(json.settings.reminder_offset_hours);
        setSubject(json.settings.email_subject);
        setBody(json.settings.email_body);
      } else {
        setMessage({ type: "error", text: json.message || "Could not load settings." });
      }
      setLoading(false);
    })();
  }, []);

  // ── Live preview ──────────────────────────────────────────────────────────
  // Memoised so we don't recompute the date strings on every keystroke when
  // only the body changed.
  const previewVars = useMemo(() => buildPreviewVars(offset), [offset]);
  const previewSubject = renderTemplate(subject, previewVars);
  const previewBody = renderTemplate(body, previewVars);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/bookings?action=reminder-settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        enabled,
        reminder_offset_hours: offset,
        email_subject: subject,
        email_body: body,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setMessage({ type: "success", text: "Settings saved." });
    } else {
      setMessage({ type: "error", text: json.message || "Save failed." });
    }
  }

  // ── Send test email ───────────────────────────────────────────────────────
  // Sends the CURRENT form state (not the saved version) so Medya can preview
  // unsaved edits in her inbox before committing them.
  async function handleSendTest() {
    setTesting(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/bookings?action=test-reminder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email_subject: subject,
        email_body: body,
        reminder_offset_hours: offset,
      }),
    });
    const json = await res.json();
    setTesting(false);
    if (json.success) {
      setMessage({
        type: "success",
        text: `Test sent to ${json.to}. Check your inbox.`,
      });
    } else {
      setMessage({ type: "error", text: json.message || "Test failed." });
    }
  }

  if (loading) {
    return <p className="text-forest/50 text-sm">Loading reminder settings…</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Left column: form ─────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Enabled toggle */}
        <div className="flex items-center gap-3 p-4 bg-white border border-sand rounded-xl">
          <input
            id="reminders-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-orange"
          />
          <label htmlFor="reminders-enabled" className="font-bold text-forest">
            Send reminder emails
          </label>
          <span className="ml-auto text-xs text-forest/50">
            {enabled ? "Active" : "Paused"}
          </span>
        </div>

        {/* Offset hours */}
        <div className="p-4 bg-white border border-sand rounded-xl">
          <label
            htmlFor="reminders-offset"
            className="block text-sm font-bold text-forest mb-2"
          >
            Send how many hours before the session?
          </label>
          <input
            id="reminders-offset"
            type="number"
            min={1}
            max={72}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value) || 0)}
            className="w-32 px-3 py-2 border border-sand rounded-lg text-forest"
          />
          <p className="text-xs text-forest/50 mt-2">
            Any value 1–72. Cron runs every 15 minutes, so reminders fire within
            ~15 min of the chosen offset.
          </p>
        </div>

        {/* Subject */}
        <div className="p-4 bg-white border border-sand rounded-xl">
          <label
            htmlFor="reminders-subject"
            className="block text-sm font-bold text-forest mb-2"
          >
            Email subject
          </label>
          <input
            id="reminders-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-sand rounded-lg text-forest"
          />
        </div>

        {/* Body */}
        <div className="p-4 bg-white border border-sand rounded-xl">
          <label
            htmlFor="reminders-body"
            className="block text-sm font-bold text-forest mb-2"
          >
            Email body (HTML)
          </label>
          <textarea
            id="reminders-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-sand rounded-lg text-forest font-mono text-sm"
          />
        </div>

        {/* Placeholder reference */}
        <div className="p-4 bg-cream border border-sand rounded-xl">
          <p className="text-sm font-bold text-forest mb-2">
            Available placeholders
          </p>
          <ul className="space-y-1 text-xs text-forest/70">
            {PLACEHOLDERS.map((p) => (
              <li key={p.token} className="flex gap-2">
                <code className="bg-white px-1.5 py-0.5 rounded border border-sand">
                  {p.token}
                </code>
                <span>{p.desc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-forest text-white text-sm font-bold rounded-xl hover:bg-orange transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing}
            className="px-5 py-2 bg-white border border-sand text-forest text-sm font-bold rounded-xl hover:bg-orange hover:text-white hover:border-orange transition-colors disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test to me"}
          </button>
        </div>

        {/* Inline status message */}
        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-forest" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {/* ── Right column: live preview ───────────────────────────────────── */}
      <div className="sticky top-6 self-start">
        <p className="text-sm font-bold text-forest mb-2">Live preview</p>
        <div className="bg-white border border-sand rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-sand bg-cream">
            <p className="text-[11px] uppercase tracking-wider text-forest/50">
              Subject
            </p>
            <p className="text-sm font-bold text-forest break-words">
              {previewSubject || (
                <span className="text-forest/30 italic">(empty)</span>
              )}
            </p>
          </div>
          <div
            className="p-4 text-sm text-forest"
            // The template body is HTML by design — Medya is the only person
            // who can write it (instructor-gated UI + RLS), so we trust it.
            dangerouslySetInnerHTML={{ __html: previewBody }}
          />
        </div>
        <p className="text-xs text-forest/50 mt-2">
          Preview uses sample data (Alex, today + {offset}h). Real reminders
          substitute each booking's actual values.
        </p>
      </div>
    </div>
  );
}
