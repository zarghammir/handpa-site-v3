// src/components/BookingEmbed.jsx
//
// An inline cal.com booking widget. The student picks a slot here without
// ever leaving our site. Cal.com handles the actual booking workflow + email
// confirmations; our cal-webhook.js receives BOOKING_CREATED and stores it in
// the bookings table.
//
// PROPS
//   calLink   — cal.com path without the domain, e.g. "medya/60min-lesson"
//   name      — pre-fill the booking form's name field
//   email     — pre-fill the booking form's email field
//   height    — iframe height in pixels (default 780)
//
// WHY AN IFRAME (not @calcom/embed-react)
//   The npm package gives slightly nicer auto-resize, but it's an extra
//   dependency to maintain and it loads cal.com's JS into our bundle. An
//   iframe with `?embed=true` is officially supported, gets the same booking
//   experience without the chrome, and is zero-config.

export default function BookingEmbed({
  calLink,
  name,
  email,
  height = 780,
}) {
  if (!calLink) return null;

  // Build prefill query params. Cal.com reads `name` and `email` from the URL
  // and pre-populates the booker form, so the student doesn't retype them.
  const params = new URLSearchParams({ embed: "true" });
  if (name) params.set("name", name);
  if (email) params.set("email", email);

  const src = `https://cal.com/${calLink}?${params.toString()}`;

  return (
    <div className="bg-white rounded-3xl border border-sand overflow-hidden shadow-sm">
      <iframe
        src={src}
        title="Book a session"
        loading="lazy"
        style={{
          width: "100%",
          height: `${height}px`,
          border: 0,
          background: "white",
        }}
      />
    </div>
  );
}
