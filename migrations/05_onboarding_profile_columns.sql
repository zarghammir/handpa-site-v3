-- ============================================================================
-- Onboarding fields on profiles
--
-- WHAT THIS DOES
--   Adds the columns the post-signup onboarding wizard fills in.
--   onboarding_complete acts as the gate: while false, Login + ProtectedRoute
--   route the student to /onboarding instead of /dashboard/student.
--
--   These were previously captured by the anonymous /signup intake form into
--   the student_intakes table. Now they live on the authenticated user's
--   profile so they're editable later and tied to the account.
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor and run. Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists onboarding_complete       boolean      not null default false,
  add column if not exists lesson_mode               text,                          -- 'online' | 'in_person'
  add column if not exists in_person_location_type   text,                          -- 'home_studio' | 'student_place'
  add column if not exists student_address           text,
  add column if not exists experience_level          text,                          -- 'complete_beginner' | ...
  add column if not exists has_handpan               boolean,
  add column if not exists availability_preferences  jsonb,                         -- [{ day, start, end }, ...]
  add column if not exists onboarding_message        text;
