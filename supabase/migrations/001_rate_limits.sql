-- Rate limiting table for API endpoints.
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/<your-project>/sql

create table if not exists rate_limits (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,   -- "route:ip"
  count       integer not null default 1,
  window_end  timestamptz not null
);

create index if not exists rate_limits_key_idx on rate_limits (key);

-- Optional: schedule cleanup via pg_cron (Supabase supports this)
-- select cron.schedule('clean-rate-limits', '*/5 * * * *', $$
--   delete from rate_limits where window_end < now();
-- $$);
