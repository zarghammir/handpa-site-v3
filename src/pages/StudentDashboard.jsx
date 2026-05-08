import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import SessionNotes from "../components/SessionNotes";

export default function StudentDashboard() {
  const [user, setUser]         = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [openNotes, setOpenNotes] = useState(null); // booking id of open notes panel

  useEffect(() => {
    async function load() {
      // Get the logged-in user from the stored session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      setUser(session.user);

      // Fetch this student's bookings by their email
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("student_email", session.user.email)
        .order("start_time", { ascending: false });

      if (!error) setBookings(data);
      setLoading(false);
    }
    load();
  }, []);

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-CA", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("en-CA", {
      hour: "2-digit", minute: "2-digit",
    });
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <p className="text-forest/50">Loading your dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-forest">
            Your Lessons
          </h1>
          <p className="text-forest/50 text-sm mt-1">
            {user?.email}
          </p>
        </div>

        {/* Empty state */}
        {bookings.length === 0 && (
          <div className="bg-white rounded-3xl border border-sand p-8 text-center">
            <p className="text-forest/50">No bookings yet.</p>
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
                    {formatTime(booking.start_time)} — {formatTime(booking.end_time)}
                  </p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  booking.status === "confirmed"
                    ? "bg-sage/20 text-sage"
                    : "bg-sand text-forest/50"
                }`}>
                  {booking.status}
                </span>
              </div>

              {/* Notes toggle button */}
              <button
                onClick={() =>
                  setOpenNotes(openNotes === booking.id ? null : booking.id)
                }
                className="text-sm font-semibold text-orange hover:text-forest transition-colors"
              >
                {openNotes === booking.id ? "Hide notes ↑" : "Session notes ↓"}
              </button>

              {/* SessionNotes — only renders when this booking's notes are open */}
              {openNotes === booking.id && user && (
                <div className="mt-4 pt-4 border-t border-sand">
                  <SessionNotes
                    bookingId={booking.id}
                    currentUser={user}
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