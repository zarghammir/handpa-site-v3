// Central sender identity for every email this site sends.
//
// EMAIL_FROM must be an address on a domain verified in Resend, or Resend
// silently refuses delivery to anyone except the account owner. The
// lotushandpan.com domain is verified and keeps working after the site's
// move to medyhandpan.com (sending domain and website domain are separate) —
// so the fallback below delivers today with the correct display name.
//
// Once medyhandpan.com is verified in Resend, set the EMAIL_FROM env var to
//   Medya Handpan <hello@medyhandpan.com>
// in Vercel and redeploy. No code change needed.
export const EMAIL_FROM =
  process.env.EMAIL_FROM || "Medya Handpan <hello@lotushandpan.com>";

// Where owner/instructor notifications go.
export const OWNER_EMAIL = process.env.CONTACT_EMAIL || "medy.tutoring@gmail.com";
