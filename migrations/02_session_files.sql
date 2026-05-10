-- ============================================================================
-- Session files — Phase 2
--
-- WHAT THIS DOES
--   1. Creates a `session_files` table that stores metadata about every file
--      uploaded against a booking (audio recordings, sheet music, exercises).
--   2. Adds RLS so only instructors can upload/delete, and students can only
--      see files attached to their own bookings.
--   3. Creates a private Supabase Storage bucket named `session-files` with
--      INSERT-only direct access (instructor uploads). Reads happen via
--      server-generated signed URLs from /api/session-files so we can
--      authorize per-booking.
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor and run. Safe to re-run.
-- ============================================================================


-- ── session_files table ──────────────────────────────────────────────────────
create table if not exists public.session_files (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  uploader_id  uuid not null references auth.users(id),
  file_path    text not null,           -- path within storage.session-files
  file_name    text not null,           -- original filename (display only)
  file_size    bigint,
  mime_type    text,
  uploaded_at  timestamptz not null default now()
);

create index if not exists session_files_booking_idx
  on public.session_files (booking_id, uploaded_at desc);

alter table public.session_files enable row level security;


-- INSERT — instructor only, and uploader_id must be themselves
drop policy if exists "session_files_insert_instructor" on public.session_files;
create policy "session_files_insert_instructor"
  on public.session_files
  for insert
  to authenticated
  with check (public.is_instructor() and uploader_id = auth.uid());

-- SELECT — instructor reads all; student reads only files for their own bookings
--
-- IMPORTANT: we fully qualify `public.session_files.booking_id` here because
-- the `bookings` table also has a column called `booking_id` (the cal.com uid,
-- type text). Without the qualification, Postgres binds the bare name to
-- `b.booking_id` (text) inside the EXISTS, then complains "uuid = text" when
-- comparing against `b.id` (uuid).
drop policy if exists "session_files_select" on public.session_files;
create policy "session_files_select"
  on public.session_files
  for select
  to authenticated
  using (
    public.is_instructor()
    or exists (
      select 1
      from public.bookings b
      where b.id = public.session_files.booking_id
        and b.student_email = (select email from auth.users where id = auth.uid())
    )
  );

-- DELETE — instructor only, must be the original uploader
drop policy if exists "session_files_delete_own" on public.session_files;
create policy "session_files_delete_own"
  on public.session_files
  for delete
  to authenticated
  using (uploader_id = auth.uid() and public.is_instructor());


-- ── Storage bucket ──────────────────────────────────────────────────────────
-- Bucket is private (public = false). Reads are mediated by signed URLs the
-- server creates after authorizing the request — see /api/session-files.
insert into storage.buckets (id, name, public)
values ('session-files', 'session-files', false)
on conflict (id) do nothing;


-- ── Storage RLS — INSERT (uploads) ─────────────────────────────────────────
-- Only instructors can write to this bucket. The service-role API endpoint
-- bypasses RLS, so list/delete via the server keeps working regardless.
drop policy if exists "session_files_storage_insert_instructor" on storage.objects;
create policy "session_files_storage_insert_instructor"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'session-files' and public.is_instructor()
  );

-- Optional: instructors can also delete directly (cleanup convenience)
drop policy if exists "session_files_storage_delete_instructor" on storage.objects;
create policy "session_files_storage_delete_instructor"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'session-files' and public.is_instructor()
  );

-- We deliberately do NOT add a SELECT policy on storage.objects for this
-- bucket. Reads must go through /api/session-files which uses the service
-- role to create signed URLs after checking the requester's authorisation.
