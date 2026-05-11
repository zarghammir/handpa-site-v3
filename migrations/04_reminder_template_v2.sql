-- ============================================================================
-- Reminder email template — v2 (branded layout, readable source)
--
-- WHAT THIS DOES
--   Replaces the default reminder email body + subject seeded in
--   migrations/03_reminders.sql with a nicer branded version. The HTML uses
--   the same Lotus Handpan brand colors as the dashboard (forest, orange,
--   sand, cream) and is formatted with line breaks + indentation so Medya
--   can read and edit it in the textarea without it looking like one wall
--   of code.
--
--   Email clients are picky, so all styling is inline (no <style> blocks)
--   and we avoid flex/grid in favor of plain block layout for max
--   compatibility (Gmail, Outlook, Apple Mail all render this cleanly).
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor and run. Safe to re-run — it just
--   overwrites the single settings row. Skip this if Medya has already
--   customized the template in the dashboard (running this will overwrite
--   her edits).
-- ============================================================================

update public.reminder_settings
set
  email_subject = 'Reminder: your handpan session is in {{hours_until}} hours',
  email_body = $$<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #2D3B1F; line-height: 1.6;">

  <div style="background: #2D3B1F; color: #FAFAF5; padding: 24px 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">
      Lotus Handpan
    </h1>
  </div>

  <div style="background: #FFFFFF; padding: 32px; border: 1px solid #EBD5AB; border-top: 0; border-radius: 0 0 12px 12px;">

    <p style="margin: 0 0 16px;">Hi {{student_name}},</p>

    <p style="margin: 0 0 24px;">
      Just a friendly reminder that your handpan session is coming up in
      <strong style="color: #E67E22;">{{hours_until}} hours</strong>.
    </p>

    <div style="background: #FAFAF5; border-left: 4px solid #E67E22; padding: 16px 20px; margin: 0 0 24px; border-radius: 6px;">
      <p style="margin: 0 0 8px;"><strong>When:</strong> {{session_date}} at {{session_time}}</p>
      <p style="margin: 0 0 8px;"><strong>Session:</strong> {{event_type}}</p>
      <p style="margin: 0;"><strong>Instructor:</strong> {{instructor_name}}</p>
    </div>

    <p style="margin: 0 0 8px;">See you soon!</p>
    <p style="margin: 0; color: #A6B28B; font-size: 14px;">— Lotus Handpan</p>

  </div>

</div>$$,
  updated_at = now()
where id = 1;
