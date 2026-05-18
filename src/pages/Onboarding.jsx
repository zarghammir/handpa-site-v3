// src/pages/Onboarding.jsx
//
// Four-step wizard a fresh student lands on right after their first login.
// Reaches /dashboard/student on completion. While onboarding_complete=false
// the rest of the app (Login redirect, ProtectedRoute) keeps sending them
// back here, so a half-finished onboarding resumes cleanly on next visit.
//
// Submission posts to /api/student-intake with the Supabase access token —
// the API updates the user's profile row, flips onboarding_complete, and
// emails Medya the same templated summary the old anonymous form sent.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIME_OPTIONS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

const EXPERIENCE_OPTIONS = [
  { value: "complete_beginner",        label: "Complete beginner",        hint: "Never touched a handpan." },
  { value: "some_musical_experience",  label: "Some musical experience",  hint: "I play another instrument." },
  { value: "already_playing_handpan",  label: "Already playing handpan",  hint: "Looking to go deeper." },
];

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    lesson_mode: "",
    in_person_location_type: "",
    student_address: "",
    experience_level: "",
    has_handpan: null,           // tri-state: null = unanswered
    availability: {},            // { Monday: { start, end }, ... }
    message: "",
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const toggleDay = (day) => {
    setForm((prev) => {
      const next = { ...prev.availability };
      if (next[day]) delete next[day];
      else next[day] = { start: "", end: "" };
      return { ...prev, availability: next };
    });
  };

  const updateTime = (day, field, value) => {
    setForm((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: { ...prev.availability[day], [field]: value },
      },
    }));
  };

  // ── Per-step validation gate ─────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 1) {
      if (!form.lesson_mode) return false;
      if (form.lesson_mode === "in_person" && !form.in_person_location_type) return false;
      if (
        form.lesson_mode === "in_person" &&
        form.in_person_location_type === "student_place" &&
        !form.student_address.trim()
      ) return false;
      return true;
    }
    if (step === 2) {
      return Boolean(form.experience_level) && form.has_handpan !== null;
    }
    if (step === 3) {
      const days = Object.entries(form.availability);
      if (days.length === 0) return false;
      return days.every(([, { start, end }]) => start && end && end > start);
    }
    return true; // step 4 message is optional
  };

  const handleNext = () => {
    setError(null);
    if (!canAdvance()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Your session expired. Please sign in again.");
      setSubmitting(false);
      navigate("/login?expired=true");
      return;
    }

    const availability_preferences = Object.entries(form.availability).map(
      ([day, { start, end }]) => ({ day, start, end })
    );

    try {
      const response = await fetch("/api/student-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lesson_mode: form.lesson_mode,
          in_person_location_type:
            form.lesson_mode === "in_person" ? form.in_person_location_type : null,
          student_address:
            form.lesson_mode === "in_person" &&
            form.in_person_location_type === "student_place"
              ? form.student_address
              : null,
          experience_level: form.experience_level,
          has_handpan: form.has_handpan,
          availability_preferences,
          message: form.message,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Something went wrong.");

      navigate("/dashboard/student");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            Welcome aboard
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-forest leading-tight">
            Let's set up your <span className="text-sage">handpan journey</span>
          </h1>
          <p className="text-forest/60 text-sm">
            A few quick questions so I can prepare your first session.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const n = i + 1;
            const active = n <= step;
            return (
              <div
                key={n}
                className={`h-2 rounded-full transition-all duration-300 ${
                  active ? "bg-orange w-8" : "bg-forest/15 w-2"
                }`}
              />
            );
          })}
        </div>
        <p className="text-center text-xs text-forest/40 mb-6 uppercase tracking-widest font-bold">
          Step {step} of {TOTAL_STEPS}
        </p>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-sand p-6 sm:p-10 shadow-sm">

          {/* Step 1 — Lesson Mode */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-forest mb-2">How would you like to learn?</h2>
                <p className="text-forest/60 text-sm">Pick whichever feels right — you can change this later.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ChoiceTile
                  selected={form.lesson_mode === "online"}
                  onClick={() => setField({ lesson_mode: "online", in_person_location_type: "", student_address: "" })}
                  title="Online"
                  hint="Live video lessons from anywhere."
                />
                <ChoiceTile
                  selected={form.lesson_mode === "in_person"}
                  onClick={() => setField({ lesson_mode: "in_person" })}
                  title="In-person"
                  hint="Face-to-face in Vancouver area."
                />
              </div>

              {form.lesson_mode === "in_person" && (
                <div className="space-y-4 rounded-3xl border border-sand bg-cream p-5">
                  <div>
                    <label className="block text-sm font-bold text-forest mb-2">
                      In-person location
                    </label>
                    <select
                      value={form.in_person_location_type}
                      onChange={(e) =>
                        setField({
                          in_person_location_type: e.target.value,
                          student_address: "",
                        })
                      }
                      className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                    >
                      <option value="">Select an option</option>
                      <option value="home_studio">Medya's home studio</option>
                      <option value="student_place">My place</option>
                    </select>
                  </div>

                  {form.in_person_location_type === "student_place" && (
                    <>
                      <div className="rounded-2xl bg-orange/10 border border-orange/20 px-4 py-3 text-sm text-forest/70">
                        Lessons at your place include a{" "}
                        <span className="font-bold text-forest">$20 commute fee</span>.
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-forest mb-2">
                          Your address
                        </label>
                        <input
                          type="text"
                          value={form.student_address}
                          onChange={(e) => setField({ student_address: e.target.value })}
                          placeholder="Street, city"
                          className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Experience + Handpan ownership */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-forest mb-2">Where are you starting from?</h2>
                <p className="text-forest/60 text-sm">No wrong answers — just helps me tailor your first session.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <ChoiceTile
                    key={opt.value}
                    selected={form.experience_level === opt.value}
                    onClick={() => setField({ experience_level: opt.value })}
                    title={opt.label}
                    hint={opt.hint}
                  />
                ))}
              </div>

              <div>
                <label className="block text-sm font-bold text-forest mb-3">
                  Do you own a handpan?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceTile
                    compact
                    selected={form.has_handpan === true}
                    onClick={() => setField({ has_handpan: true })}
                    title="Yes"
                  />
                  <ChoiceTile
                    compact
                    selected={form.has_handpan === false}
                    onClick={() => setField({ has_handpan: false })}
                    title="No"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Availability */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-forest mb-2">When are you free?</h2>
                <p className="text-forest/60 text-sm">Pick the days that usually work, then set a time window for each.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const on = Boolean(form.availability[day]);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all ${
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

              {Object.keys(form.availability).length > 0 && (
                <div className="space-y-3">
                  {Object.keys(form.availability).map((day) => (
                    <div key={day} className="rounded-3xl border border-sand bg-cream p-4">
                      <p className="font-bold text-forest mb-3">{day}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={form.availability[day].start}
                          onChange={(e) => updateTime(day, "start", e.target.value)}
                          className="w-full rounded-2xl border border-forest/15 bg-white px-3 py-2.5 text-sm text-forest outline-none focus:border-orange"
                        >
                          <option value="">Start</option>
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select
                          value={form.availability[day].end}
                          onChange={(e) => updateTime(day, "end", e.target.value)}
                          className="w-full rounded-2xl border border-forest/15 bg-white px-3 py-2.5 text-sm text-forest outline-none focus:border-orange"
                        >
                          <option value="">End</option>
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Message */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-forest mb-2">Anything I should know?</h2>
                <p className="text-forest/60 text-sm">Goals, injuries, scales you're drawn to — totally optional.</p>
              </div>

              <textarea
                value={form.message}
                onChange={(e) => setField({ message: e.target.value })}
                rows="6"
                placeholder="Tell me about your goals or anything else I should know..."
                className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest outline-none focus:border-orange transition-colors resize-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || submitting}
              className="px-5 py-3 text-forest font-semibold rounded-2xl border border-forest/15 hover:bg-sand transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance()}
                className="px-8 py-3 bg-orange text-white font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 bg-forest text-cream font-bold rounded-2xl shadow-md hover:bg-sage hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {submitting ? "Finishing..." : "Finish & Go to Dashboard →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable selectable tile ───────────────────────────────────────────────
function ChoiceTile({ selected, onClick, title, hint, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border-2 transition-all ${
        compact ? "px-4 py-3" : "px-5 py-4"
      } ${
        selected
          ? "border-orange bg-orange/5 shadow-sm"
          : "border-forest/10 bg-white hover:border-forest/25 hover:bg-cream"
      }`}
    >
      <p className={`font-bold ${selected ? "text-orange" : "text-forest"}`}>{title}</p>
      {hint && <p className="text-forest/55 text-sm mt-1">{hint}</p>}
    </button>
  );
}
