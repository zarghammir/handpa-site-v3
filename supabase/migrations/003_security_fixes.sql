-- ============================================================
-- Security fixes — 2026-08-16 QA audit
--
-- HOW TO RUN: paste into the Supabase SQL editor and run once.
-- Safe to re-run (all statements are idempotent).
--
-- Every read/write these policies used to allow is already served
-- by the API layer with the service_role key (which bypasses RLS),
-- so nothing on the site loses functionality.
-- ============================================================

-- 1) testimonials: the public SELECT policy exposed ALL rows and ALL
--    columns — including unapproved testimonials and their secret
--    approval_token, letting anyone approve their own submission.
--    Restrict public reads to approved rows only. (The approval token
--    is nulled on approval by the API, so approved rows leak nothing.)
DROP POLICY IF EXISTS "testimonials_select_public" ON public.testimonials;

CREATE POLICY "testimonials_select_approved"
  ON public.testimonials FOR SELECT
  TO anon, authenticated
  USING (approved = true);

-- 2) gift_codes: any signed-up user could SELECT every gift code plus
--    gifter/recipient names and emails — theft of paid lessons + PII
--    leak. Redemption goes through /api/gift-redeem (service_role),
--    so clients never need direct reads.
DROP POLICY IF EXISTS "gift_codes_select_authenticated" ON public.gift_codes;

-- 3) chat_sessions: the anon UPDATE policy (USING true) let any holder
--    of the public anon key rewrite ANY chat session row. All chat
--    writes go through /api/chat (service_role).
DROP POLICY IF EXISTS "chat_sessions_update_own" ON public.chat_sessions;

-- 4) gift_codes: enforce webhook idempotency at the database level.
--    Two concurrent Stripe webhook deliveries could both pass the
--    check-then-insert and create two codes for one payment.
CREATE UNIQUE INDEX IF NOT EXISTS gift_codes_stripe_session_id_key
  ON public.gift_codes (stripe_session_id);

-- 5) Rebrand the live reminder email template (it was seeded saying
--    "Lotus Handpan") and widen the reminder window to 24h so the
--    once-daily Vercel cron covers every next-day session.
UPDATE public.reminder_settings
SET email_body = replace(email_body, 'Lotus Handpan', 'Medya Handpan'),
    reminder_offset_hours = 24,
    updated_at = now()
WHERE id = 1;
