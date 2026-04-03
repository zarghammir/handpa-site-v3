import { useMemo } from "react";

const BASE_DATE = "2026-04-01T00:00:00";

const BASE_STATS = {
  students: 18,
  hours: 270,
  lessons: 157,
};

function calculateStats() {
  const now = new Date();
  const start = new Date(BASE_DATE);

  const diffMs = now - start;
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const addedStudents = Math.floor(diffDays / 14); // +1 every 2 weeks
  const addedHours = Math.floor(diffDays / 7) * 6; // +6 every week
  const addedLessons = Math.floor(diffDays / 7) * 4; // +4 every week

  return {
    students: BASE_STATS.students + addedStudents,
    hours: BASE_STATS.hours + addedHours,
    lessons: BASE_STATS.lessons + addedLessons,
  };
}

export default function LiveStats({ type, suffix = "" }) {
  const stats = useMemo(() => calculateStats(), []);

  return (
    <span>
      {stats[type]}
      {suffix}
    </span>
  );
}