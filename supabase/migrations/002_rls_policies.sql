-- ============================================================
-- RLS policies for all public tables
-- ============================================================

-- -------------------------------------------------------
-- rate_limits
-- Internal table used by server-side API routes only.
-- No direct client access needed — service_role bypasses RLS.
-- -------------------------------------------------------
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated users get no access.
-- Server-side code uses the service_role key which bypasses RLS.

-- -------------------------------------------------------
-- bookings
-- Users can only see and manage their own bookings.
-- Anon users can insert (to make a booking without an account).
-- -------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_own"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_anon"
  ON public.bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "bookings_update_own"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- chat_leads
-- Write-only for anon (submit a lead), no public reads.
-- Reads happen server-side via service_role.
-- -------------------------------------------------------
ALTER TABLE public.chat_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_leads_insert_anon"
  ON public.chat_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- -------------------------------------------------------
-- chat_sessions
-- Write-only for anon (create/update a session), no public reads.
-- -------------------------------------------------------
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_insert_anon"
  ON public.chat_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "chat_sessions_update_own"
  ON public.chat_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------
-- testimonials
-- Public read (displayed on site). Only service_role can write.
-- -------------------------------------------------------
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_select_public"
  ON public.testimonials FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------
-- gift_codes
-- Authenticated users can SELECT to validate/redeem a code.
-- No public reads of all codes; writes via service_role only.
-- -------------------------------------------------------
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_codes_select_authenticated"
  ON public.gift_codes FOR SELECT
  TO authenticated
  USING (true);

-- -------------------------------------------------------
-- student_intakes
-- Write-only for anon (submit intake form). No public reads.
-- -------------------------------------------------------
ALTER TABLE public.student_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_intakes_insert_anon"
  ON public.student_intakes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- -------------------------------------------------------
-- profiles (already has RLS enabled)
-- Fix the overly permissive INSERT policy.
-- Users can only insert/update their own profile row.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow insert for trigger" ON public.profiles;

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- If a trigger creates the profile row on signup (via service_role),
-- the trigger runs as service_role which bypasses RLS — no extra policy needed.
