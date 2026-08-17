// src/pages/StudentDashboard.jsx
//
// THESIS: a student's lessons are a conversation with their teacher, not a
// table of bookings; this surface refuses the flat white admin-card list.
// OWN-WORLD: the site's warm world at full depth — cream ground, deep forest
// hero panel with a faint handpan tone-circle, sage timeline spine, orange
// reserved for the single booking action, notes as chat bubbles.
// STORY: open the page → your next lesson greets you with a countdown →
// scroll your journey with Medya, newest first → one thumb-height button
// books the next.
// FIRST VIEWPORT (mobile): header row; full-width forest Next Lesson card
// with big date, time, countdown chip and calendar action; the journey spine
// begins beneath; sticky orange Book bar in the thumb zone.
// FORM: chat-thread chronology — candidate 5 of 7, seed 8ce413f2 (assigned).
//
// VIEWS (no tab bar — the journey IS the page):
//   journey — hero + timeline (default)
//   book    — cal.com embed, reached from the sticky CTA, with a back link
//   profile — StudentProfileTab via the avatar menu, with a back link

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { authedFetch } from "../lib/api";
import SessionNotes from "../components/SessionNotes";
import BookingEmbed from "../components/BookingEmbed";
import StudentProfileTab from "../components/StudentProfileTab";
import UserMenu from "../components/UserMenu";

const CAL_EVENT_LINK = "medya/60min-lesson";

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
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function longDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function timeRange(start, end) {
  const opts = { hour: "numeric", minute: "2-digit" };
  const startLabel = new Date(start).toLocaleTimeString([], opts);
  // end_time can be null (some webhook payloads omit it) — show just the
  // start rather than "… — Invalid Date".
  if (!end) return startLabel;
  return `${startLabel} — ${new Date(end).toLocaleTimeString([], opts)}`;
}

// "today" / "tomorrow" / "in N days" — the hero countdown chip.
function countdownLabel(iso) {
  const now = new Date();
  const start = new Date(iso);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);
  if (days <= 0) {
    const hours = Math.max(0, Math.round((start - now) / 3_600_000));
    if (hours <= 1) return "starting soon";
    return `today · in ${hours}h`;
  }
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

// Google Calendar wants a prefilled-event URL; Apple (and Outlook) want a
// downloadable .ics. We offer both from one "Add to calendar" menu.
function googleCalendarUrl(booking) {
  const fmt = (iso) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end =
    booking.end_time ||
    new Date(new Date(booking.start_time).getTime() + 3_600_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Handpan lesson with Medya",
    dates: `${fmt(booking.start_time)}/${fmt(end)}`,
    details:
      "Your handpan lesson — notes live at https://www.medyhandpan.com/dashboard/student",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// Build a downloadable .ics so "Add to calendar" works on every device
// without any third-party link.
function downloadIcs(booking) {
  const fmt = (iso) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end =
    booking.end_time ||
    new Date(new Date(booking.start_time).getTime() + 3_600_000).toISOString();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Medya Handpan//Lessons//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@medyhandpan.com`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(booking.start_time)}`,
    `DTEND:${fmt(end)}`,
    "SUMMARY:Handpan lesson with Medya",
    "DESCRIPTION:Your handpan lesson — see notes at https://www.medyhandpan.com/dashboard/student",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "handpan-lesson.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [view, setView] = useState("journey");
  const [openBookingId, setOpenBookingId] = useState(null);
  // booking_id → { notes, files } so collapsed stops can say what Medya
  // left there instead of repeating the booking's time slot.
  const [threadCounts, setThreadCounts] = useState({});
  const [calMenuOpen, setCalMenuOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadError(null);
      setLoading(true);
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
          .select("full_name, avatar_url, created_at")
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
      // A failed query must NOT look like "No lessons yet" — surface it.
      if (bookingRes.error) {
        setLoadError("Couldn't load your lessons. Check your connection and retry.");
      } else {
        const rows = bookingRes.data ?? [];
        setBookings(rows);
        loadThreadCounts(rows);
      }
      setLoading(false);
    }
    load();
  }, [reloadTick]);

  // One API round-trip gives every stop its "2 notes · 1 file" summary
  // (students can't read session_notes directly under RLS). Best-effort:
  // while unknown, stops show a quiet chevron rather than a wrong claim.
  async function loadThreadCounts(rows) {
    if (!rows?.length) return;
    const result = await authedFetch("/api/session?type=summary");
    if (result.ok && result.data.counts) setThreadCounts(result.data.counts);
  }

  // Keep collapsed counts truthful when the student posts into a thread.
  function bumpThreadCount(bookingId, kind) {
    setThreadCounts((prev) => {
      const cur = prev[bookingId] ?? { notes: 0, files: 0 };
      const key = kind === "file" ? "files" : "notes";
      return { ...prev, [bookingId]: { ...cur, [key]: cur[key] + 1 } };
    });
  }

  // Chronological lesson numbers, then split around "now". Upcoming beyond
  // the hero renders at the top of the spine; past renders newest-first.
  const { next, upcomingRest, past, numberById } = useMemo(() => {
    const now = Date.now();
    const numberById = {};
    bookings.forEach((b, i) => {
      numberById[b.id] = i + 1;
    });
    const upcoming = bookings.filter(
      (b) => new Date(b.end_time || b.start_time).getTime() >= now
    );
    const past = bookings
      .filter((b) => new Date(b.end_time || b.start_time).getTime() < now)
      .slice()
      .reverse(); // ascending source → newest first
    return {
      next: upcoming[0] ?? null,
      upcomingRest: upcoming.slice(1),
      past,
      numberById,
    };
  }, [bookings]);

  // The most recent past lesson opens by default — it's what students come
  // back for (Medya's notes from the last session).
  useEffect(() => {
    if (openBookingId === null && past.length > 0) {
      setOpenBookingId(past[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past]);

  // The journey's origin must never postdate its own first stop: anchor on
  // whichever is earliest — the first lesson or the account creation.
  const origin = useMemo(() => {
    const fmt = (iso) =>
      new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const firstLesson = bookings[0]?.start_time ?? null;
    const joined = profile?.created_at ?? null;
    if (firstLesson && (!joined || new Date(joined) > new Date(firstLesson))) {
      return `your first lesson · ${fmt(firstLesson)}`;
    }
    if (joined) return `you joined · ${fmt(joined)}`;
    return null;
  }, [bookings, profile]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream px-4 pt-10">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 w-44 rounded-xl bg-sand/60 animate-pulse mb-6" />
          <div className="h-52 rounded-3xl bg-forest/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pt-6 sm:pt-10 px-4 pb-36">
      <div className="max-w-2xl mx-auto">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-black text-forest tracking-tight truncate">
            Your Lessons
          </h1>
          <UserMenu
            user={user}
            profile={profile}
            onOpenProfile={() => setView("profile")}
            onSignOut={handleSignOut}
          />
        </div>

        {/* ── Load error ─────────────────────────────────────── */}
        {loadError && (
          <div className="mb-6 rounded-[22px] border border-[#E5BFAE] bg-[#FBF0E9] px-5 py-4 flex items-center justify-between gap-4 shadow-[0_3px_10px_-4px_rgba(45,59,31,0.12)]">
            <p className="text-sm font-semibold text-[#8A3B24]">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadTick((t) => t + 1)}
              className="shrink-0 text-sm font-extrabold text-[#8A3B24] border-[1.5px] border-[#D9A78F] rounded-full px-4 py-1.5 hover:bg-[#F5E0D2] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ══ PROFILE VIEW ══════════════════════════════════════ */}
        {view === "profile" && user && (
          <div>
            <BackLink onClick={() => setView("journey")} />
            <StudentProfileTab user={user} />
          </div>
        )}

        {/* ══ BOOK VIEW (intro copy — embed renders wide below) ═ */}
        {view === "book" && (
          <div>
            <BackLink onClick={() => setView("journey")} />
            <p className="text-forest/60 text-sm mb-4 px-1">
              Pick a 60-minute slot below. Medya confirms it shortly
              afterwards, then it appears in your journey.
            </p>
          </div>
        )}

        {/* ══ JOURNEY VIEW ══════════════════════════════════════ */}
        {view === "journey" && (
          <>
            {/* Next lesson hero */}
            <section
              aria-label="Your next lesson"
              className="relative overflow-hidden rounded-[26px] text-cream px-6 py-6 shadow-[0_18px_40px_-18px_rgba(45,59,31,0.55),0_4px_12px_-6px_rgba(45,59,31,0.35)] animate-hero-rise"
              style={{
                background:
                  "radial-gradient(120% 90% at 85% -10%, rgba(166,178,139,0.35), transparent 55%)," +
                  "radial-gradient(100% 120% at 0% 110%, rgba(230,126,34,0.16), transparent 50%)," +
                  "linear-gradient(160deg, #3A4C28, #2D3B1F 60%)",
              }}
            >
              {/* faint handpan tone-circle etched into the panel */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-[70px] -top-[70px] w-[230px] h-[230px] rounded-full border border-cream/10"
                style={{
                  boxShadow:
                    "inset 0 0 0 28px rgba(250,250,245,0.035), inset 0 0 0 62px rgba(250,250,245,0.03)",
                }}
              />
              {next ? (
                <>
                  <h2 className="text-[15px] font-semibold text-cream/75 mb-3">
                    Your next lesson
                  </h2>
                  <p className="text-[32px] sm:text-[38px] font-extrabold leading-[1.1] tracking-tight [text-wrap:balance]">
                    {longDate(next.start_time)}
                  </p>
                  <p className="mt-1.5 text-[17px] text-cream/85 tabular-nums">
                    {timeRange(next.start_time, next.end_time)} · with Medya
                  </p>
                  <div className="mt-4 flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-2 rounded-full bg-cream/15 border border-cream/20 px-3.5 py-1.5 text-[13.5px] font-bold text-sand">
                      <span className="w-[7px] h-[7px] rounded-full bg-orange shadow-[0_0_8px_1px_rgba(230,126,34,0.8)]" />
                      {countdownLabel(next.start_time)}
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCalMenuOpen((v) => !v)}
                        aria-expanded={calMenuOpen}
                        aria-haspopup="menu"
                        className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/35 px-3.5 py-1.5 text-[13.5px] font-bold text-cream hover:bg-cream/10 hover:border-cream/60 transition-colors"
                      >
                        <CalendarIcon className="w-[15px] h-[15px]" />
                        Add to calendar
                        <ChevronIcon
                          className={`w-3 h-3 transition-transform ${
                            calMenuOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {calMenuOpen && (
                        <div
                          role="menu"
                          className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-[210px] rounded-2xl bg-white border border-forest/10 shadow-[0_12px_30px_-10px_rgba(45,59,31,0.4)] p-1.5 flex flex-col"
                        >
                          <a
                            role="menuitem"
                            href={googleCalendarUrl(next)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setCalMenuOpen(false)}
                            className="rounded-xl px-3.5 py-2.5 text-[14px] font-bold text-forest hover:bg-cream transition-colors"
                          >
                            Google Calendar
                          </a>
                          <button
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              downloadIcs(next);
                              setCalMenuOpen(false);
                            }}
                            className="rounded-xl px-3.5 py-2.5 text-[14px] font-bold text-forest text-left hover:bg-cream transition-colors"
                          >
                            Apple / Outlook (.ics)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-[15px] font-semibold text-cream/75 mb-3">
                    Nothing booked yet
                  </h2>
                  <p className="text-[28px] sm:text-[34px] font-extrabold leading-[1.15] tracking-tight [text-wrap:balance]">
                    Ready for your next lesson?
                  </p>
                  <p className="mt-1.5 text-[16px] text-cream/85">
                    Pick a time that suits you — Medya confirms it personally.
                  </p>
                </>
              )}
            </section>

            {/* Journey */}
            <section className="mt-9" aria-label="Your lesson journey">
              <h2 className="text-xl font-extrabold text-forest tracking-tight mb-0.5">
                Your journey
              </h2>
              <p className="text-sm text-forest/60 mb-6">
                Every lesson keeps its notes and files — from you and from
                Medya.
              </p>

              {bookings.length === 0 && !loadError && (
                <div className="relative pl-[30px] timeline-spine pb-2">
                  <div className="relative journey-stop" style={{ animationDelay: "0.3s" }}>
                    <span
                      aria-hidden="true"
                      className="absolute -left-[27px] top-[7px] w-[13px] h-[13px] rounded-full bg-cream border-[3px] border-orange/60 shadow-[0_0_0_5px_rgba(230,126,34,0.12)]"
                    />
                    <div className="rounded-[22px] border border-sand bg-sand/30 px-5 py-5 shadow-[0_3px_10px_-4px_rgba(45,59,31,0.12)]">
                      <p className="font-extrabold text-forest">
                        Your first lesson goes here
                      </p>
                      <p className="text-sm text-forest/70 mt-1 max-w-[42ch]">
                        Once Medya confirms a booking it appears on this
                        timeline, with her notes and practice files after each
                        session.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {bookings.length > 0 && (
                <div className="relative pl-[30px] timeline-spine">
                  {upcomingRest.map((b, i) => (
                    <JourneyStop
                      key={b.id}
                      booking={b}
                      lessonNo={numberById[b.id]}
                      upcoming
                      delayIndex={i}
                      counts={threadCounts[b.id]}
                      isOpen={openBookingId === b.id}
                      onToggle={() =>
                        setOpenBookingId(openBookingId === b.id ? null : b.id)
                      }
                      user={user}
                      onThreadChange={(kind) => bumpThreadCount(b.id, kind)}
                    />
                  ))}
                  {past.map((b, i) => (
                    <JourneyStop
                      key={b.id}
                      booking={b}
                      lessonNo={numberById[b.id]}
                      latest={i === 0}
                      delayIndex={upcomingRest.length + i}
                      counts={
                        Object.keys(threadCounts).length
                          ? threadCounts[b.id] ?? { notes: 0, files: 0 }
                          : undefined
                      }
                      isOpen={openBookingId === b.id}
                      onToggle={() =>
                        setOpenBookingId(openBookingId === b.id ? null : b.id)
                      }
                      user={user}
                      onThreadChange={(kind) => bumpThreadCount(b.id, kind)}
                    />
                  ))}
                  {origin && (
                    <p
                      className="relative py-1 text-[13.5px] font-semibold text-forest/70 origin-dot journey-origin"
                      style={{ animationDelay: `${Math.min(0.3 + (upcomingRest.length + past.length) * 0.12, 1)}s` }}
                    >
                      Where it started — {origin}
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Book view embed gets the wide column cal.com wants on desktop */}
      {view === "book" && (
        <div className="max-w-5xl mx-auto mt-2">
          <BookingEmbed
            calLink={CAL_EVENT_LINK}
            name={profile?.full_name}
            email={user?.email}
          />
        </div>
      )}

      {/* ── Sticky book bar (journey view only) ───────────────── */}
      {view === "journey" && (
        <div className="fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 pointer-events-none bg-gradient-to-t from-cream via-cream/90 to-transparent">
          <button
            type="button"
            onClick={() => {
              setView("book");
              window.scrollTo({ top: 0 });
            }}
            className="pointer-events-auto w-full max-w-2xl flex items-center justify-center gap-2.5 rounded-2xl bg-orange text-white text-[16.5px] font-extrabold px-5 py-4 shadow-[0_10px_26px_-10px_rgba(230,126,34,0.65),0_3px_8px_-4px_rgba(45,59,31,0.3)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgba(230,126,34,0.7),0_4px_10px_-4px_rgba(45,59,31,0.3)] transition-all"
          >
            <CalendarPlusIcon className="w-[18px] h-[18px]" />
            {next ? "Book another lesson" : "Book your next lesson"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── JourneyStop ── one lesson on the spine ────────────────────────────────
function JourneyStop({ booking, lessonNo, latest, upcoming, delayIndex = 0, counts, isOpen, onToggle, user, onThreadChange }) {
  // Collapsed stops advertise the conversation, not the booking slot:
  // "2 notes · 1 file", or an honest quiet fallback.
  const metaParts = [];
  if (counts?.notes) metaParts.push(`${counts.notes} note${counts.notes > 1 ? "s" : ""}`);
  if (counts?.files) metaParts.push(`${counts.files} file${counts.files > 1 ? "s" : ""}`);
  const metaLabel = upcoming
    ? timeRange(booking.start_time, booking.end_time)
    : metaParts.length
    ? metaParts.join(" · ")
    : counts
    ? "no notes yet"
    : ""; // counts still loading/unavailable — claim nothing

  return (
    <div
      className="relative pb-8 journey-stop"
      style={{ animationDelay: `${Math.min(0.3 + delayIndex * 0.12, 0.9)}s` }}
    >
      {/* spine dot */}
      <span
        aria-hidden="true"
        className={`absolute -left-[27px] top-[7px] w-[13px] h-[13px] rounded-full bg-cream border-[3px] ${
          latest
            ? "border-orange shadow-[0_0_0_5px_rgba(230,126,34,0.15)]"
            : upcoming
            ? "border-orange/50"
            : "border-sage"
        }`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-baseline justify-between gap-3 text-left mb-3 group"
      >
        <span className="text-[16.5px] font-extrabold text-forest tracking-tight">
          {dayLabel(booking.start_time)} · Lesson {lessonNo}
          {upcoming && (
            <span className="ml-2 align-middle text-[11px] font-bold uppercase tracking-wide text-orange/80">
              upcoming
            </span>
          )}
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-forest/70 whitespace-nowrap group-hover:text-forest transition-colors">
          {metaLabel}
          <ChevronIcon
            className={`inline-block w-3 h-3 ml-1.5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {isOpen && user && (
        <>
          {!upcoming && (
            <p className="text-[12.5px] font-semibold text-forest/70 -mt-1 mb-2.5">
              {timeRange(booking.start_time, booking.end_time)}
            </p>
          )}
          <SessionNotes
            bookingId={booking.id}
            currentUser={user}
            userRole="student"
            onThreadChange={onThreadChange}
          />
        </>
      )}
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-forest/60 hover:text-forest transition-colors"
    >
      <ChevronIcon className="w-3.5 h-3.5 rotate-90" />
      Back to your lessons
    </button>
  );
}

// ── Icons — one stroke family, drawn inline ───────────────────────────────
function CalendarIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18M12 14v4M10 16h4" />
    </svg>
  );
}
function CalendarPlusIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18M12 13v6M9 16h6" />
    </svg>
  );
}
function ChevronIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
