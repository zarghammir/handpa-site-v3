// src/components/LoginCalendar.jsx
//
// A small month-view calendar that highlights every day the student logged in.
// Pure React + Tailwind — no external date library.
//
// PROPS
//   logins  — array of objects with a `logged_in_at` ISO timestamp
//             (matches the shape returned by the login_history Supabase table)
//
// HOW IT BUILDS THE GRID
//   1. Take a "cursor" date (defaults to today).
//   2. Find the first day of that month and its weekday (0=Sun..6=Sat).
//   3. Pad the grid with empty cells before day 1 so day 1 lands in the right
//      weekday column. Then fill cells 1..lastDayOfMonth.
//   4. For each filled cell, build a YYYY-MM-DD key and check whether it's in
//      the Set of login dates.

import { useMemo, useState } from "react";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(d) {
  // Local-timezone YYYY-MM-DD — avoids the off-by-one bug that toISOString()
  // would cause for users east of UTC near midnight.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LoginCalendar({ logins = [] }) {
  const [cursor, setCursor] = useState(() => new Date());

  // Build the set once per `logins` change. Using a Set makes lookups O(1).
  const loginDates = useMemo(
    () => new Set(logins.map((l) => dateKey(new Date(l.logged_in_at)))),
    [logins]
  );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthName = cursor.toLocaleString("en-US", { month: "long" });
  const todayKey = dateKey(new Date());

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));

  return (
    <div className="bg-white rounded-3xl border border-sand p-6 shadow-sm">
      {/* Header — month name + nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="text-forest/60 hover:text-forest px-2 py-1 rounded hover:bg-cream"
        >
          ←
        </button>
        <h3 className="font-bold text-forest">
          {monthName} {year}
        </h3>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next month"
          className="text-forest/60 hover:text-forest px-2 py-1 rounded hover:bg-cream"
        >
          →
        </button>
      </div>

      {/* Day-of-week row */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {DOW.map((d, i) => (
          <div key={i} className="text-xs font-bold text-forest/40 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = dateKey(new Date(year, month, day));
          const hasLogin = loginDates.has(key);
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center text-sm rounded-lg ${
                hasLogin
                  ? "bg-sage/30 text-forest font-bold"
                  : "text-forest/50"
              } ${isToday ? "ring-2 ring-orange" : ""}`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <p className="text-xs text-forest/50 mt-4 flex items-center gap-2">
        <span className="inline-block w-3 h-3 bg-sage/30 rounded-sm" />
        Days you signed in
      </p>
    </div>
  );
}
