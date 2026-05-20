// Student profile tab — displays account info and lets the student edit
// what they originally entered during onboarding (lesson mode + availability).
// Password reset reuses the same Supabase resetPasswordForEmail flow as
// the /forgot-password page so we don't duplicate logic.

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import AddressAutocomplete from "./AddressAutocomplete";

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
];

const TIME_OPTIONS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

const SITE_URL = import.meta.env.VITE_SITE_URL ?? window.location.origin;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB — matches the instructor cap
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export default function StudentProfileTab({ user }) {
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetState, setResetState] = useState({ sending: false, message: null });

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    avatar_url: "",
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
        .select("full_name, email, avatar_url, created_at, lesson_mode, in_person_location_type, student_address, availability_preferences")
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
          avatar_url: data.avatar_url ?? "",
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

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      setFeedback({ type: "error", text: "Use a PNG, JPEG, or WEBP image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFeedback({ type: "error", text: "Image must be under 2 MB." });
      return;
    }

    setUploading(true);
    setFeedback(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase
      .storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      setFeedback({ type: "error", text: uploadErr.message });
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateErr) {
      setFeedback({ type: "error", text: updateErr.message });
    } else {
      setProfile((p) => ({ ...p, avatar_url: publicUrl }));
      setFeedback({ type: "success", text: "Photo updated." });
    }
    setUploading(false);
  };

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

    // Route through the API so the server can update the profile AND email
    // Medya in a single trip. Doing the update client-side and the email
    // server-side would risk drift if the email request failed silently.
    const { data: { session } } = await supabase.auth.getSession();

    // Supabase keeps the session in localStorage and shares it across tabs.
    // If the user signed into a different account in another tab while this
    // page was open, `session.user.id` no longer matches the `user.id` we
    // loaded the profile with — saving now would write the new schedule to
    // the wrong account. Bail out cleanly instead of silently corrupting
    // another profile.
    if (!session?.user?.id || session.user.id !== user.id) {
      setFeedback({
        type: "error",
        text:
          "Your session has changed in another tab. Please refresh this page " +
          "and sign back in before saving.",
      });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/student-intake?type=availability-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lesson_mode: profile.lesson_mode,
          in_person_location_type:
            profile.lesson_mode === "in_person" ? profile.in_person_location_type || null : null,
          student_address:
            profile.lesson_mode === "in_person" &&
            profile.in_person_location_type === "student_place"
              ? profile.student_address
              : null,
          availability_preferences,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFeedback({ type: "error", text: json.error || "Could not save changes." });
      } else {
        setFeedback({ type: "success", text: "Profile updated. Medya has been notified." });
      }
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Could not save changes." });
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

      {/* Profile photo */}
      <section className="bg-white rounded-3xl border border-sand p-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50 mb-4">
          Profile photo
        </h2>

        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-sand overflow-hidden flex items-center justify-center text-forest/30 font-bold text-2xl shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              profile.full_name?.[0]?.toUpperCase() ?? "?"
            )}
          </div>

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleAvatarPick}
              disabled={uploading}
              className="px-4 py-2 bg-forest text-cream font-bold rounded-xl hover:bg-sage transition-colors disabled:opacity-60 text-sm"
            >
              {uploading ? "Uploading..." : "Change photo"}
            </button>
            <p className="text-xs text-forest/40 mt-2">
              PNG, JPEG, or WEBP. Max 2 MB.
            </p>
          </div>
        </div>
      </section>

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
                <AddressAutocomplete
                  value={profile.student_address}
                  onChange={(v) => setProfile((p) => ({ ...p, student_address: v }))}
                  countryCodes={["ca"]}
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
