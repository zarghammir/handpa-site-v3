// src/components/BookingAgenda.jsx
//
// A vertical agenda view of upcoming bookings, grouped by day.
//
// PROPS
//   bookings    — array of bookings (with start_time, end_time, status,
//                 student_name, student_email)
//   onSelect    — optional callback fired when a booking card is clicked
//                 (lets the parent open notes / drill into a student)
//   activeId    — booking id to highlight (e.g. the one with notes open)
//
// LAYOUT
//   - Group bookings by their local YYYY-MM-DD start date
//   - Show day headers ("Today", "Tomorrow", "Mon, Mar 9")
//   - Cards inside each day list start–end time + student name + status badge
//   - Cancelled bookings render dimmed and struck through
//
// We sort ascending so the next booking is at the top — the instructor's
// natural reading order.

import { useMemo } from "react";

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (dateKey(date) === dateKey(today)) return "Today";
  if (dateKey(date) === dateKey(tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeStr(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookingAgenda({ bookings = [], onSelect, activeId }) {
  // Group by day, ascending. We filter out anything without a start_time
  // (defensive — shouldn't happen, but a missing date would crash sort).
  const grouped = useMemo(() => {
    const sorted = bookings
      .filter((b) => !!b.start_time)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

    const buckets = new Map();
    for (const b of sorted) {
      const key = dateKey(new Date(b.start_time));
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(b);
    }
    return Array.from(buckets.entries()); // [ [key, bookings[]], ... ]
  }, [bookings]);

  if (grouped.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-sand p-8 text-center">
        <p className="text-forest/50">No bookings yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(([key, dayBookings]) => {
        const date = new Date(`${key}T00:00:00`);
        return (
          <div key={key}>
            <h3 className="text-sm font-black uppercase tracking-wider text-forest/60 mb-2">
              {dayLabel(date)}
            </h3>

            <div className="flex flex-col gap-2">
              {dayBookings.map((b) => {
                const isCancelled = b.status === "cancelled";
                const isPending = b.status === "pending";
                const isActive = activeId === b.id;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelect?.(b)}
                    className={`text-left rounded-2xl border px-4 py-3 transition-all ${
                      isActive
                        ? "border-orange bg-orange/5 shadow-md"
                        : "border-sand bg-white hover:border-forest/30"
                    } ${isCancelled ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={`font-bold text-forest ${
                            isCancelled ? "line-through" : ""
                          }`}
                        >
                          {b.student_name || b.student_email || "Student"}
                        </p>
                        <p className="text-sm text-forest/60 mt-0.5">
                          {timeStr(b.start_time)}
                          {b.end_time && ` — ${timeStr(b.end_time)}`}
                          {b.event_type && ` · ${b.event_type}`}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${
                          isCancelled
                            ? "bg-red-100 text-red-500"
                            : isPending
                            ? "bg-sand text-forest/60"
                            : "bg-sage/20 text-sage"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
