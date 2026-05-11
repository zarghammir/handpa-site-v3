-- ============================================================================
-- Booking reminder emails — Phase 3
--
-- WHAT THIS DOES
--   1. Creates a `reminder_settings` table that stores the configurable
--      reminder template + offset. It is a singleton — exactly one row keyed
--      by a constant `id = 1` so the API can always `select * from
--      reminder_settings where id = 1`. The CHECK constraint enforces this.
--   2. Adds a `reminder_sent_at` column to `bookings` so the cron job can
--      tell which bookings have already been reminded and avoid duplicates.
--   3. Sets up RLS:
--        • reminder_settings — anyone authenticated can READ (so we can show
--          "reminder sent ✓" badges if we want); only instructors can WRITE.
--        • bookings — the new column inherits the existing table's policies,
--          but we add nothing new here.
--   4. Seeds a sensible default reminder template so the feature works
--      immediately after migration (12-hour offset, friendly copy).
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor and run. Safe to re-run.
-- ============================================================================


-- ── reminder_settings table ──────────────────────────────────────────────────
-- Singleton. We force exactly one row by constraining the primary key to the
-- literal value 1. Any attempt to insert a second row will violate the PK,
-- and our CHECK adds a defensive belt-and-braces.
create table if not exists public.reminder_settings (
  id                    int  primary key default 1,
  enabled               boolean      not null default true,
  reminder_offset_hours int          not null default 12
                                     check (reminder_offset_hours between 1 and 72),
  email_subject         text         not null default 'Reminder: your handpan session is in {{hours_until}} hours',
  email_body            text         not null default
    '<p>Hi {{student_name}},</p>'
    '<p>Just a friendly reminder that your handpan session is coming up in '
    '<strong>{{hours_until}} hours</strong>.</p>'
    '<p><strong>When:</strong> {{session_date}} at {{session_time}}<br>'
    '<strong>Instructor:</strong> {{instructor_name}}</p>'
    '<p>See you soon!<br>— Lotus Handpan</p>',
  updated_at            timestamptz  not null default now(),
  updated_by            uuid         references auth.users(id),
  constraint reminder_settings_singleton check (id = 1)
);

alter table public.reminder_settings enable row level security;

-- SELECT — any authenticated user. Cheap to allow; nothing sensitive lives here.
drop policy if exists "reminder_settings_select" on public.reminder_settings;
create policy "reminder_settings_select"
  on public.reminder_settings
  for select
  to authenticated
  using (true);

-- UPDATE — instructor only. We use UPDATE (not INSERT) because the singleton
-- row is seeded below and never deleted.
drop policy if exists "reminder_settings_update_instructor" on public.reminder_settings;
create policy "reminder_settings_update_instructor"
  on public.reminder_settings
  for update
  to authenticated
  using (public.is_instructor())
  with check (public.is_instructor());

-- Seed the singleton row. ON CONFLICT keeps this idempotent.
insert into public.reminder_settings (id) values (1)
on conflict (id) do nothing;


-- ── bookings.reminder_sent_at ────────────────────────────────────────────────
-- Nullable timestamptz. NULL means "no reminder sent yet". The cron sets it
-- to now() after a successful send. Reschedule / status changes clear it
-- back to NULL via the trigger below so a rescheduled booking gets a fresh
-- reminder for its new time.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- Index for the cron's hot-path query: "find confirmed bookings whose
-- start_time is approaching and which haven't been reminded yet".
-- Partial index keeps it small — we only care about NULL rows.
create index if not exists bookings_reminder_pending_idx
  on public.bookings (start_time)
  where reminder_sent_at is null and status = 'confirmed';


-- ── Reset reminder_sent_at on reschedule ─────────────────────────────────────
-- If start_time changes (cal.com reschedule) we want the new time to get a
-- fresh reminder, so we null out reminder_sent_at. We do NOT do this for
-- every UPDATE — only when start_time actually changes — otherwise routine
-- status updates would re-trigger reminders.
create or replace function public.reset_reminder_on_reschedule()
returns trigger
language plpgsql
as $$
begin
  if NEW.start_time is distinct from OLD.start_time then
    NEW.reminder_sent_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bookings_reset_reminder_on_reschedule on public.bookings;
create trigger bookings_reset_reminder_on_reschedule
  before update on public.bookings
  for each row
  execute function public.reset_reminder_on_reschedule();
