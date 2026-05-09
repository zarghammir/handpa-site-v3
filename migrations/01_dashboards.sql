-- ============================================================================
-- Dashboards build — Phase 1
--
-- WHAT THIS DOES
--   1. Creates a `login_history` table to track student sign-ins
--   2. Adds an `updated_at` column to `session_notes` so we can show "edited" stamps
--   3. Adds Row Level Security (RLS) policies so:
--        - students see/insert only their own login_history rows
--        - instructors can read every profile, booking, and login_history
--        - instructors can update booking status (confirmed/cancelled)
--   4. Defines a SECURITY DEFINER helper `is_instructor()` so policies can
--      check role without infinite recursion (a policy on `profiles` cannot
--      itself query `profiles` in INVOKER mode)
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL editor and run.
--   Safe to re-run — every statement uses IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================================


-- ── Helper: is the current user an instructor? ───────────────────────────────
-- SECURITY DEFINER means this function runs with the privileges of its owner
-- (postgres), bypassing RLS. We need that because RLS policies on `profiles`
-- would otherwise recurse when we try to look up the role inside a policy.
create or replace function public.is_instructor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'instructor'
  );
$$;

grant execute on function public.is_instructor() to authenticated;


-- ── login_history table ──────────────────────────────────────────────────────
create table if not exists public.login_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  logged_in_at timestamptz not null default now()
);

create index if not exists login_history_user_idx
  on public.login_history (user_id, logged_in_at desc);

alter table public.login_history enable row level security;

-- INSERT — a user can record their own login (auth.uid() must match user_id)
drop policy if exists "login_history_insert_own" on public.login_history;
create policy "login_history_insert_own"
  on public.login_history
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- SELECT — students read their own; instructors read all
drop policy if exists "login_history_select" on public.login_history;
create policy "login_history_select"
  on public.login_history
  for select
  to authenticated
  using (
    user_id = auth.uid() or public.is_instructor()
  );


-- ── session_notes — add updated_at + edit policy ─────────────────────────────
alter table public.session_notes
  add column if not exists updated_at timestamptz;

-- Author can update their own note
drop policy if exists "session_notes_update_own" on public.session_notes;
create policy "session_notes_update_own"
  on public.session_notes
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());


-- ── bookings — instructor read-all + update status ───────────────────────────
drop policy if exists "bookings_instructor_select_all" on public.bookings;
create policy "bookings_instructor_select_all"
  on public.bookings
  for select
  to authenticated
  using (public.is_instructor());

drop policy if exists "bookings_instructor_update_all" on public.bookings;
create policy "bookings_instructor_update_all"
  on public.bookings
  for update
  to authenticated
  using (public.is_instructor())
  with check (public.is_instructor());


-- ── profiles — instructor reads every profile (for the student list) ─────────
drop policy if exists "profiles_instructor_select_all" on public.profiles;
create policy "profiles_instructor_select_all"
  on public.profiles
  for select
  to authenticated
  using (public.is_instructor());
