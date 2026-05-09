import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import SessionNotes from "../components/SessionNotes";
import LoginCalendar from "../components/LoginCalendar";

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNotes, setOpenNotes] = useState(null); // booking id of open notes panel

  useEffect(() => {
    async function load() {
      // Get the logged-in user from the stored session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      // Fetch confirmed bookings + login history in parallel — saves a round-trip.
      const [bookingRes, loginRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*")
          .eq("student_email", session.user.email)
          .eq("status", "confirmed")
          .order("start_time", { ascending: false }),
        supabase
          .from("login_history")
          .select("logged_in_at")
          .eq("user_id", session.user.id)
          .order("logged_in_at", { ascending: false })
          .limit(365), // Plenty for a month-view calendar
      ]);

      if (!bookingRes.error) setBookings(bookingRes.data);
      if (!loginRes.error) setLogins(loginRes.data);
      setLoading(false);
    }
    load();
  }, []);

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
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-forest">Your Lessons</h1>
            <p className="text-forest/50 text-sm mt-1">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-semibold text-forest/60 hover:text-orange transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Login calendar */}
        <div className="mb-8">
          <LoginCalendar logins={logins} />
        </div>

        {/* Section heading */}
        <h2 className="text-xl font-black text-forest mb-4">
          Confirmed appointments
        </h2>

        {/* Empty state */}
        {bookings.length === 0 && (
          <div className="bg-white rounded-3xl border border-sand p-8 text-center">
            <p className="text-forest/50">No confirmed appointments yet.</p>
            <p className="text-forest/40 text-sm mt-2">
              Once your instructor confirms a booking, it will appear here.
            </p>
          </div>
        )}

        {/* Booking cards */}
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-3xl border border-sand p-6 shadow-sm"
            >
              {/* Booking info */}
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
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-sage/20 text-sage">
                  confirmed
                </span>
              </div>

              {/* Notes toggle button */}
              <button
                type="button"
                onClick={() =>
                  setOpenNotes(openNotes === booking.id ? null : booking.id)
                }
                className="text-sm font-semibold text-orange hover:text-forest transition-colors"
              >
                {openNotes === booking.id ? "Hide notes ↑" : "Session notes ↓"}
              </button>

              {/* SessionNotes — read for student, reply only after instructor seeds */}
              {openNotes === booking.id && user && (
                <div className="mt-4 pt-4 border-t border-sand">
                  <SessionNotes
                    bookingId={booking.id}
                    currentUser={user}
                    userRole="student"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
