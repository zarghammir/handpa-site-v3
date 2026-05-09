import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import SessionNotes from "../components/SessionNotes";
import BookingEmbed from "../components/BookingEmbed";

// The cal.com event slug for paid 60-min lessons. The student books from the
// embed below; cal.com fires BOOKING_CREATED → our webhook stores it →
// instructor approves on cal.com → it appears in "Confirmed appointments".
const CAL_EVENT_LINK = "medya/60min-lesson";

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNotes, setOpenNotes] = useState(null); // booking id of open notes panel

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

      // Fetch profile (for cal.com prefill name) + confirmed bookings in parallel.
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
          .order("start_time", { ascending: false }),
      ]);

      if (!profileRes.error) setProfile(profileRes.data);
      if (!bookingRes.error) setBookings(bookingRes.data);
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

        {/* Confirmed appointments — what's already booked + approved */}
        <h2 className="text-xl font-black text-forest mb-4">
          Confirmed appointments
        </h2>

        {bookings.length === 0 && (
          <div className="bg-white rounded-3xl border border-sand p-8 text-center">
            <p className="text-forest/50">No confirmed appointments yet.</p>
            <p className="text-forest/40 text-sm mt-2">
              Book a session below — it will appear here once your instructor
              approves it.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
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
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-sage/20 text-sage">
                  confirmed
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenNotes(openNotes === booking.id ? null : booking.id)
                }
                className="text-sm font-semibold text-orange hover:text-forest transition-colors"
              >
                {openNotes === booking.id ? "Hide notes ↑" : "Session notes ↓"}
              </button>

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

        {/* Book a new session — cal.com embed */}
        <div className="mt-12">
          <h2 className="text-xl font-black text-forest mb-2">
            Book your next session
          </h2>
          <p className="text-forest/60 text-sm mb-4">
            Pick a 60-minute slot below. Your instructor will confirm it
            shortly afterwards.
          </p>
          <BookingEmbed
            calLink={CAL_EVENT_LINK}
            name={profile?.full_name}
            email={user?.email}
          />
        </div>
      </div>
    </div>
  );
}
