// src/pages/InstructorDashboard.jsx
//
// Instructor's unified workspace.
//
// LAYOUT
//   Two tabs:
//     "Agenda"   — day-grouped list of upcoming bookings, with notes inline.
//                  This is where Medya spends most of her time.
//     "Students" — roster view: pick a student, see all their bookings + notes
//                  history. Reused from the previous version of this page.
//
// REALTIME
//   We subscribe to bookings INSERT and UPDATE events so the agenda updates
//   the moment a cal.com webhook fires (BOOKING_CREATED / _RESCHEDULED /
//   _CANCELLED). Cleaner than polling, and matches the SessionNotes pattern.

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import SessionNotes from "../components/SessionNotes";
import BookingAgenda from "../components/BookingAgenda";
import RemindersSettings from "../components/RemindersSettings";
import InstructorProfileTab from "../components/InstructorProfileTab";

const TABS = [
  { id: "agenda", label: "Agenda" },
  { id: "students", label: "Students" },
  { id: "reminders", label: "Reminders" },
  { id: "profile", label: "Profile" },
];

export default function InstructorDashboard() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("agenda");

  // Agenda state — all upcoming bookings for any student
  const [allBookings, setAllBookings] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [openNotesAgenda, setOpenNotesAgenda] = useState(null);

  // Students-tab state — same per-student drill-down as before
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentBookings, setStudentBookings] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingStudentBookings, setLoadingStudentBookings] = useState(false);
  const [openNotesStudent, setOpenNotesStudent] = useState(null);
  const [search, setSearch] = useState("");

  // ── Load instructor + agenda + roster on mount ───────────────────────────
  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);

      const [bookingsRes, studentsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .order("start_time", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "student")
          .order("full_name", { ascending: true }),
      ]);

      if (!bookingsRes.error) setAllBookings(bookingsRes.data ?? []);
      if (!studentsRes.error) setStudents(studentsRes.data ?? []);
      setLoadingAgenda(false);
      setLoadingStudents(false);
    }
    load();
  }, []);

  // ── Realtime: bookings INSERT + UPDATE ───────────────────────────────────
  // Cal.com webhook fires → row appears here within ~1s. No refresh needed.
  useEffect(() => {
    const channel = supabase
      .channel("bookings-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          setAllBookings((prev) => {
            if (prev.some((b) => b.id === payload.new.id)) return prev;
            return [...prev, payload.new].sort(
              (a, b) =>
                new Date(a.start_time).getTime() -
                new Date(b.start_time).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        (payload) => {
          setAllBookings((prev) =>
            prev.map((b) => (b.id === payload.new.id ? payload.new : b))
          );
          setStudentBookings((prev) =>
            prev.map((b) => (b.id === payload.new.id ? payload.new : b))
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ── Students tab — load a single student's bookings ──────────────────────
  useEffect(() => {
    if (!selectedStudent) {
      setStudentBookings([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingStudentBookings(true);
      setOpenNotesStudent(null);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("student_email", selectedStudent.email)
        .order("start_time", { ascending: false });
      if (cancelled) return;
      if (!error) setStudentBookings(data ?? []);
      setLoadingStudentBookings(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);

  // ── Status updates (instructor confirm/cancel) ───────────────────────────
  async function updateStatus(bookingId, status) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id: bookingId, status }),
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.error || "Could not update booking.");
      return;
    }
    // calSyncWarning is set when our DB updated but cal.com didn't accept the
    // change — Medya needs to fix it manually in cal.com to avoid divergence.
    if (json.calSyncWarning) {
      alert(
        `Saved in dashboard, but cal.com didn't accept the change. ` +
        `Open cal.com to update there too. (${json.calSyncWarning})`
      );
    }
    // Realtime UPDATE event will refresh the local state — no manual setBookings
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // Agenda shows only bookings whose end_time is in the future, plus today.
  // We keep cancelled ones visible so Medya notices them — they render dimmed.
  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000; // include today even if started
    return allBookings.filter(
      (b) => new Date(b.end_time || b.start_time).getTime() > cutoff
    );
  }, [allBookings]);

  const pendingCount = allBookings.filter((b) => b.status === "pending").length;

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-cream pt-8 sm:pt-12 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-forest">
              Instructor Dashboard
            </h1>
            <p className="text-forest/50 text-sm mt-1">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 bg-white border border-sand text-sm font-bold text-forest hover:bg-orange hover:text-white hover:border-orange rounded-xl transition-colors whitespace-nowrap"
          >
            Log out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-sand">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-bold border-b-2 -mb-[1px] transition-colors ${
                tab === t.id
                  ? "border-orange text-forest"
                  : "border-transparent text-forest/50 hover:text-forest"
              }`}
            >
              {t.label}
              {t.id === "agenda" && pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center text-[10px] font-bold bg-orange text-white rounded-full px-1.5 min-w-5 h-5">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Agenda tab ────────────────────────────────────────────── */}
        {tab === "agenda" && (
          <div>
            {loadingAgenda && (
              <p className="text-forest/50 text-sm">Loading agenda…</p>
            )}

            {!loadingAgenda && (
              <BookingAgenda
                bookings={upcomingBookings}
                activeId={openNotesAgenda}
                onSelect={(b) =>
                  setOpenNotesAgenda(openNotesAgenda === b.id ? null : b.id)
                }
              />
            )}

            {/* Inline detail panel for the selected agenda booking */}
            {openNotesAgenda && user && (() => {
              const booking = allBookings.find((b) => b.id === openNotesAgenda);
              if (!booking) return null;
              return (
                <div className="mt-4 bg-white rounded-3xl border border-sand p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-bold text-forest">
                        {booking.student_name || booking.student_email}
                      </p>
                      <p className="text-sm text-forest/60 mt-0.5">
                        {formatDate(booking.start_time)} ·{" "}
                        {formatTime(booking.start_time)}
                        {" — "}
                        {formatTime(booking.end_time)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        booking.status === "confirmed"
                          ? "bg-sage/20 text-sage"
                          : booking.status === "cancelled"
                          ? "bg-red-100 text-red-500"
                          : "bg-sand text-forest/50"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  {/* Status actions */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {booking.status !== "confirmed" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(booking.id, "confirmed")
                        }
                        className="text-xs font-bold px-3 py-1.5 bg-sage text-cream rounded-full hover:bg-forest transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                    {booking.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(booking.id, "cancelled")
                        }
                        className="text-xs font-bold px-3 py-1.5 bg-white border border-forest/15 text-forest/60 rounded-full hover:border-red-300 hover:text-red-500 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="border-t border-sand pt-4">
                    <SessionNotes
                      bookingId={booking.id}
                      currentUser={user}
                      userRole="instructor"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Students tab ─────────────────────────────────────────── */}
        {tab === "students" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left — student list */}
            <aside className="md:col-span-1">
              <div className="bg-white rounded-3xl border border-sand p-4 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-wider text-forest/60 mb-3 px-2">
                  Students ({students.length})
                </h2>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full mb-3 rounded-xl border border-forest/15 bg-cream px-3 py-2 text-sm text-forest placeholder:text-forest/35 outline-none focus:border-orange"
                />

                {loadingStudents && (
                  <p className="text-xs text-forest/50 px-2">Loading…</p>
                )}

                {!loadingStudents && students.length === 0 && (
                  <p className="text-xs text-forest/50 px-2">No students yet.</p>
                )}

                <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
                  {filteredStudents.map((s) => {
                    const isSelected = selectedStudent?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStudent(s)}
                        className={`text-left rounded-xl px-3 py-2 transition-colors ${
                          isSelected
                            ? "bg-forest text-cream"
                            : "hover:bg-cream text-forest"
                        }`}
                      >
                        <p className="text-sm font-bold truncate">
                          {s.full_name || s.email}
                        </p>
                        {s.full_name && (
                          <p
                            className={`text-xs truncate ${
                              isSelected ? "text-cream/70" : "text-forest/50"
                            }`}
                          >
                            {s.email}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Right — selected student */}
            <section className="md:col-span-2">
              {!selectedStudent && (
                <div className="bg-white rounded-3xl border border-sand p-12 text-center">
                  <p className="text-forest/50">
                    Select a student to see their bookings and notes.
                  </p>
                </div>
              )}

              {selectedStudent && (
                <>
                  <div className="bg-white rounded-3xl border border-sand p-6 shadow-sm mb-4">
                    <h2 className="text-2xl font-black text-forest">
                      {selectedStudent.full_name || selectedStudent.email}
                    </h2>
                    {selectedStudent.full_name && (
                      <p className="text-forest/50 text-sm">
                        {selectedStudent.email}
                      </p>
                    )}
                  </div>

                  {loadingStudentBookings && (
                    <p className="text-forest/50 text-sm">Loading bookings…</p>
                  )}

                  {!loadingStudentBookings && studentBookings.length === 0 && (
                    <div className="bg-white rounded-3xl border border-sand p-8 text-center">
                      <p className="text-forest/50">
                        No bookings for this student yet.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    {studentBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="bg-white rounded-3xl border border-sand p-6 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <p className="font-bold text-forest">
                              {formatDate(booking.start_time)}
                            </p>
                            <p className="text-sm text-forest/60 mt-0.5">
                              {formatTime(booking.start_time)} —{" "}
                              {formatTime(booking.end_time)}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full ${
                              booking.status === "confirmed"
                                ? "bg-sage/20 text-sage"
                                : booking.status === "cancelled"
                                ? "bg-red-100 text-red-500"
                                : "bg-sand text-forest/50"
                            }`}
                          >
                            {booking.status}
                          </span>
                        </div>

                        <div className="flex gap-2 mb-3 flex-wrap">
                          {booking.status !== "confirmed" && (
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(booking.id, "confirmed")
                              }
                              className="text-xs font-bold px-3 py-1.5 bg-sage text-cream rounded-full hover:bg-forest transition-colors"
                            >
                              Confirm
                            </button>
                          )}
                          {booking.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(booking.id, "cancelled")
                              }
                              className="text-xs font-bold px-3 py-1.5 bg-white border border-forest/15 text-forest/60 rounded-full hover:border-red-300 hover:text-red-500 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenNotesStudent(
                              openNotesStudent === booking.id
                                ? null
                                : booking.id
                            )
                          }
                          className="text-sm font-semibold text-orange hover:text-forest transition-colors"
                        >
                          {openNotesStudent === booking.id
                            ? "Hide notes ↑"
                            : "Session notes ↓"}
                        </button>

                        {openNotesStudent === booking.id && user && (
                          <div className="mt-4 pt-4 border-t border-sand">
                            <SessionNotes
                              bookingId={booking.id}
                              currentUser={user}
                              userRole="instructor"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ── Reminders tab ─────────────────────────────────────────── */}
        {tab === "reminders" && (
          <div>
            <RemindersSettings />
          </div>
        )}

        {/* ── Profile tab ───────────────────────────────────────────── */}
        {tab === "profile" && user && (
          <InstructorProfileTab user={user} />
        )}
      </div>
    </div>
  );
}
