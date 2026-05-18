-- ============================================================================
-- Profile bio + avatar
--
-- WHAT THIS DOES
--   1. Adds `bio` + `avatar_url` columns to profiles (for the instructor's
--      editable profile blurb and uploaded photo).
--   2. Creates the `avatars` storage bucket (public) if it doesn't exist.
--   3. Adds RLS policies so authenticated users can manage files inside
--      their own folder (path: `<auth.uid()>/...`), and everyone can read.
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor and run. Safe to re-run.
-- ============================================================================

-- ── Columns on profiles ────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists bio        text,
  add column if not exists avatar_url text;


-- ── Avatars storage bucket ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;


-- ── Storage RLS — readable by all, writable by owning user ────────────────
-- The owning user is identified by the first folder segment matching auth.uid().
-- Upload path convention from the client: `<user_id>/avatar.<ext>`.
drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
