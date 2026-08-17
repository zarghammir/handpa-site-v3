---
version: 1
slug: "src-pages-studentdashboard-jsx"
primary_target: "src/pages/StudentDashboard.jsx"
related_targets: ["src/components/SessionNotes.jsx"]
---

# Surface brief — Student dashboard (/dashboard/student)

Scope: the logged-in student lessons view. Mode: Operate.

Audience & job: ~30 non-technical handpan students, mostly on phones, coming
back to (1) check when their next lesson is, (2) re-read Medya's notes from
the last one, (3) book the next. Success = all three within seconds, no
learning curve.

Chosen direction: chat-thread chronology (seed 8ce413f2, candidate 5/7).
Next-lesson hero (deep forest panel, faint handpan tone-circle, countdown
chip, .ics add-to-calendar) → "Your journey" sage timeline, newest first,
notes as chat bubbles (Medya left/white, student right/sand) → single sticky
orange Book action in the thumb zone. No tab bar; book and profile are
sub-views with a back link. Memorable moment: the hero rise + timeline
drawing itself on load.

Constraints: booking lives in the embedded cal.com iframe (untouched);
SessionNotes is shared with the instructor dashboard — visual language may
evolve, behavior may not; orange appears only on the booking action and the
latest-lesson dot.

Unresolved: no per-lesson note/file counts on collapsed stops (would need a
batch endpoint); files playable inline (audio player vs. open-in-tab) is a
possible follow-up.
