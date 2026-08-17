-- Join links for lessons — 2026-08-16
-- Stores the video-call URL cal.com reports for each booking (Google Meet
-- once the Meet app is connected; Cal Video before that). The dashboard's
-- Join button falls back to https://app.cal.com/video/<uid> when this is
-- empty, so old rows need no backfill.
-- HOW TO RUN: paste into the Supabase SQL editor and run once.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS meeting_url text;
