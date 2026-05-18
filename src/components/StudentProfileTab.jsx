// Student profile tab — displays account info and lets the student edit
// what they originally entered during onboarding (lesson mode + availability).
// Password reset reuses the same Supabase resetPasswordForEmail flow as
// the /forgot-password page so we don't duplicate logic.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
];

const TIME_OPTIONS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

const SITE_URL = import.meta.env.VITE_SITE_URL ?? window.location.origin;

export default function StudentProfileTab({ user }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetState, setResetState] = useState({ sending: false, message: null });

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    created_at: null,
    lesson_mode: "online",
    in_person_location_type: "",
    student_address: "",
    availability: {},
  });

  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, created_at, lesson_mode, in_person_location_type, student_address, availability_preferences")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        const availability = {};
        for (const slot of data.availability_preferences ?? []) {
          availability[slot.day] = { start: slot.start, end: slot.end };
        }
        setProfile({
          full_name: data.full_name ?? "",
          email: data.email ?? user.email ?? "",
          created_at: data.created_at,
          lesson_mode: data.lesson_mode ?? "online",
          in_person_location_type: data.in_person_location_type ?? "",
          student_address: data.student_address ?? "",
          availability,
        });
      }
      setLoading(false);
    }
    load();
  }, [user.id, user.email]);

  const toggleDay = (day) => {
    setProfile((prev) => {
      const next = { ...prev.availability };
      if (next[day]) delete next[day];
      else next[day] = { start: "", end: "" };
      return { ...prev, availability: next };
    });
  };

  const updateTime = (day, field, value) => {
    setProfile((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: { ...prev.availability[day], [field]: value },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);

    // Sanity-check availability before saving.
    const slots = Object.entries(profile.availability);
    for (const [day, { start, end }] of slots) {
      if (!start || !end) {
        setFeedback({ type: "error", text: `Pick a start and end time for ${day}.` });
        setSaving(false);
        return;
      }
      if (end <= start) {
        setFeedback({ type: "error", text: `For ${day}, end time must be later than start.` });
        setSaving(false);
        return;
      }
    }

    const availability_preferences = slots.map(([day, { start, end }]) => ({ day, start, end }));

    const { error } = await supabase
      .from("profiles")
      .update({
        lesson_mode: profile.lesson_mode,
        in_person_location_type:
          profile.lesson_mode === "in_person" ? profile.in_person_location_type || null : null,
        student_address:
          profile.lesson_mode === "in_person" &&
          profile.in_person_location_type === "student_place"
            ? profile.student_address
            : null,
        availability_preferences,
      })
      .eq("id", user.id);

    if (error) {
      setFeedback({ type: "error", text: error.message });
    } else {
      setFeedback({ type: "success", text: "Profile updated." });
    }
    setSaving(false);
  };

  const handlePasswordReset = async () => {
    setResetState({ sending: true, message: null });
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    setResetState({
      sending: false,
      message: error
        ? { type: "error", text: error.message }
        : { type: "success", text: `Reset link sent to ${profile.email}.` },
    });
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center text-forest/50 text-sm">
        Loading profile...
      </div>
    );
  }

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Account info — read-only */}
      <section className="bg-white rounded-3xl border border-sand p-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50 mb-4">
          Account
        </h2>
        <dl className="space-y-3 text-sm">
          <Row label="Name" value={profile.full_name || "—"} />
          <Row label="Email" value={profile.email} />
          {memberSince && <Row label="Member since" value={memberSince} />}
        </dl>
      </section>

      {/* Lesson preferences */}
      <section className="bg-white rounded-3xl border border-sand p-6 space-y-5">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50">
          Lesson preference
        </h2>

        <div>
          <label className="block text-sm font-bold text-forest mb-2">Mode</label>
          <select
            value={profile.lesson_mode}
            onChange={(e) => setProfile((p) => ({
              ...p,
              lesson_mode: e.target.value,
              in_person_location_type: "",
              student_address: "",
            }))}
            className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange"
          >
            <option value="online">Online</option>
            <option value="in_person">In-person</option>
          </select>
        </div>

        {profile.lesson_mode === "in_person" && (
          <div className="space-y-4 rounded-2xl border border-sand bg-cream p-4">
            <div>
              <label className="block text-sm font-bold text-forest mb-2">In-person location</label>
              <select
                value={profile.in_person_location_type}
                onChange={(e) => setProfile((p) => ({
                  ...p,
                  in_person_location_type: e.target.value,
                  student_address: "",
                }))}
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange"
              >
                <option value="">Select an option</option>
                <option value="home_studio">Medya's home studio</option>
                <option value="student_place">My place</option>
              </select>
            </div>

            {profile.in_person_location_type === "student_place" && (
              <div>
                <label className="block text-sm font-bold text-forest mb-2">Address</label>
                <input
                  type="text"
                  value={profile.student_address}
                  onChange={(e) => setProfile((p) => ({ ...p, student_address: e.target.value }))}
                  placeholder="Street, city"
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange"
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Availability */}
      <section className="bg-white rounded-3xl border border-sand p-6 space-y-4">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50">
          Availability
        </h2>

        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const on = Boolean(profile.availability[day]);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
                  on
                    ? "bg-orange text-white border-orange"
                    : "bg-white text-forest border-forest/15 hover:bg-sand"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {Object.keys(profile.availability).length > 0 && (
          <div className="space-y-3 pt-2">
            {Object.keys(profile.availability).map((day) => (
              <div key={day} className="rounded-2xl border border-sand bg-cream p-4">
                <p className="font-bold text-forest mb-3">{day}</p>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={profile.availability[day].start}
                    onChange={(e) => updateTime(day, "start", e.target.value)}
                    className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest outline-none focus:border-orange"
                  >
                    <option value="">Start</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    value={profile.availability[day].end}
                    onChange={(e) => updateTime(day, "end", e.target.value)}
                    className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest outline-none focus:border-orange"
                  >
                    <option value="">End</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-orange text-white font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>

      {/* Password */}
      <section className="bg-white rounded-3xl border border-sand p-6 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50">
          Password
        </h2>
        <p className="text-forest/60 text-sm">
          We'll email you a link to set a new password.
        </p>
        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={resetState.sending}
          className="px-5 py-3 bg-forest text-cream font-bold rounded-2xl hover:bg-sage transition-colors disabled:opacity-60"
        >
          {resetState.sending ? "Sending..." : "Send reset email"}
        </button>
        {resetState.message && (
          <p
            className={`text-sm font-medium ${
              resetState.message.type === "success" ? "text-green-700" : "text-red-700"
            }`}
          >
            {resetState.message.text}
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-forest/40">
        {label}
      </dt>
      <dd className="text-forest font-medium break-all">{value}</dd>
    </div>
  );
}
