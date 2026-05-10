// src/pages/StudentDashboard.jsx
//
// Student-facing dashboard.
//
// LAYOUT
//   Two tabs (mobile-first, large tap targets):
//     "Lessons" — past + upcoming confirmed sessions, each with notes + files
//     "Book"    — cal.com 60-min embed for booking another session
//
// LESSONS GROUPING
//   We split confirmed bookings into "Upcoming" and "Past" with friendly
//   day labels (Today / Tomorrow / Mon, May 12). Past sessions are dimmed
//   slightly so the eye lands on what's coming up.

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import SessionNotes from "../components/SessionNotes";
import BookingEmbed from "../components/BookingEmbed";

const CAL_EVENT_LINK = "medya/60min-lesson";

const TABS = [
  { id: "lessons", label: "Lessons" },
  { id: "book", label: "Book" },
];

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeRange(start, end) {
  const opts = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(start).toLocaleTimeString([], opts)} — ${new Date(
    end
  ).toLocaleTimeString([], opts)}`;
}

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("lessons");
  const [openBookingId, setOpenBookingId] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      const [profileRes, bookingRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .single(),
        supabase
          .from("bookings")
          .select("*")
          .eq("student_email", session.user.email)
          .eq("status", "confirmed")
          .order("start_time", { ascending: true }),
      ]);

      if (!profileRes.error) setProfile(profileRes.data);
      if (!bookingRes.error) setBookings(bookingRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Split bookings into upcoming vs past based on end_time. Upcoming is
  // sorted ascending (next session first), past descending (most recent first).
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcoming = [];
    const past = [];
    for (const b of bookings) {
      const endMs = new Date(b.end_time || b.start_time).getTime();
      if (endMs >= now) upcoming.push(b);
      else past.push(b);
    }
    upcoming.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
    return { upcoming, past };
  }, [bookings]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-forest/50">Loading your dashboard...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-cream pt-20 sm:pt-24 pb-16 px-4">
      {/* Header + tabs — narrow column even on desktop. The Book tab below
          breaks out wider so cal.com has room for its horizontal layout. */}
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-forest truncate">
              Your Lessons
            </h1>
            <p className="text-forest/50 text-xs sm:text-sm mt-1 truncate">
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-semibold text-forest/60 hover:text-orange transition-colors whitespace-nowrap"
          >
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6 bg-white rounded-2xl p-1 border border-sand">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`py-2.5 text-sm font-bold rounded-xl transition-all ${
                  active
                    ? "bg-forest text-cream shadow-sm"
                    : "text-forest/60 hover:text-forest"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lessons tab ─────────────────────────────────────────── */}
      {tab === "lessons" && (
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col gap-8">
            {/* Empty state */}
            {bookings.length === 0 && (
              <div className="bg-white rounded-3xl border border-sand p-8 text-center">
                <p className="text-forest/60 font-bold">No lessons yet</p>
                <p className="text-forest/40 text-sm mt-2">
                  Tap the <span className="font-bold">Book</span> tab above to
                  schedule your first session.
                </p>
              </div>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <Section title="Upcoming">
                {upcoming.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    isOpen={openBookingId === b.id}
                    onToggle={() =>
                      setOpenBookingId(openBookingId === b.id ? null : b.id)
                    }
                    user={user}
                  />
                ))}
              </Section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <Section title="Past sessions">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    isOpen={openBookingId === b.id}
                    onToggle={() =>
                      setOpenBookingId(openBookingId === b.id ? null : b.id)
                    }
                    user={user}
                    dimmed
                  />
                ))}
              </Section>
            )}
          </div>
        </div>
      )}

      {/* ── Book tab ────────────────────────────────────────────── */}
      {/* Wider container (max-w-5xl ≈ 1024px) so cal.com renders its
          horizontal 3-column layout on desktop. On mobile (<900px) the
          embed gracefully falls back to the stacked slots view. */}
      {tab === "book" && (
        <div className="max-w-5xl mx-auto">
          <p className="text-forest/60 text-sm mb-4 px-1">
            Pick a 60-minute slot below. Your instructor will confirm it
            shortly afterwards, then it'll show up under Lessons.
          </p>
          <BookingEmbed
            calLink={CAL_EVENT_LINK}
            name={profile?.full_name}
            email={user?.email}
          />
        </div>
      )}
    </div>
  );
}

// ── Section ─ small reusable header for "Upcoming" / "Past sessions" ─
function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xs font-black uppercase tracking-wider text-forest/50 mb-3 px-1">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// ── BookingCard ──────────────────────────────────────────────────────
// One confirmed booking. Tap the whole card to expand notes + files.
function BookingCard({ booking, isOpen, onToggle, user, dimmed }) {
  return (
    <div
      className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
        isOpen ? "border-orange" : "border-sand"
      } ${dimmed ? "opacity-70" : ""}`}
    >
      {/* Whole header row is the toggle — big tap target */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 hover:bg-cream/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-forest">{dayLabel(booking.start_time)}</p>
            <p className="text-sm text-forest/60 mt-0.5">
              {timeRange(booking.start_time, booking.end_time)}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-sage/20 text-sage whitespace-nowrap">
            {isOpen ? "Hide ↑" : "Open ↓"}
          </span>
        </div>
      </button>

      {/* Expanded content — unified notes & files thread */}
      {isOpen && user && (
        <div className="px-5 pb-5 border-t border-sand pt-4">
          <SessionNotes
            bookingId={booking.id}
            currentUser={user}
            userRole="student"
          />
        </div>
      )}
    </div>
  );
}
