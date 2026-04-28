import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only allow GET (Vercel cron) or POST (manual trigger)
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  // Verify the request comes from Vercel's cron system
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const now = new Date();
  // 45–75 min window: cron runs every 15 min, so every booking is caught exactly once
  const in45m = new Date(now.getTime() + 45 * 60 * 1000);
  const in75m = new Date(now.getTime() + 75 * 60 * 1000);

  // Find confirmed bookings starting ~1 h from now that haven't been reminded yet
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("booking_id, student_name, student_email, event_type, start_time, end_time")
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .gte("start_time", in45m.toISOString())
    .lte("start_time", in75m.toISOString());

  if (error) {
    console.error("Supabase query error:", error);
    return res.status(500).json({ message: "DB query failed." });
  }

  if (!bookings || bookings.length === 0) {
    return res.status(200).json({ message: "No reminders to send.", sent: 0 });
  }

  let sent = 0;
  const failed = [];

  for (const booking of bookings) {
    if (!booking.student_email) continue;

    const startDate = new Date(booking.start_time);
    const endDate   = new Date(booking.end_time);

    const dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
      timeZone: "UTC",
    });
    const startStr = startDate.toLocaleTimeString("en-US", {
      hour:     "2-digit",
      minute:   "2-digit",
      timeZone: "UTC",
    });
    const endStr = endDate.toLocaleTimeString("en-US", {
      hour:     "2-digit",
      minute:   "2-digit",
      timeZone: "UTC",
    });

    try {
      await resend.emails.send({
        from:    "Handpan Lessons <onboarding@resend.dev>",
        to:      booking.student_email,
        subject: `Starting in 1 hour: Your handpan session — ${startStr}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <h2 style="margin-bottom:4px">See you in about an hour! 🎵</h2>
            <p>Hi ${booking.student_name},</p>
            <p>Your <strong>${booking.event_type}</strong> session starts in approximately 1 hour:</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr>
                <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:120px">Date</td>
                <td style="padding:8px 12px;background:#f5f5f5">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:600">Time</td>
                <td style="padding:8px 12px">${startStr} – ${endStr} UTC</td>
              </tr>
            </table>
            <p>If you need to reschedule or have any questions, please reply to this email as soon as possible.</p>
            <p style="margin-top:32px">Looking forward to making music with you,<br><strong>Medya</strong></p>
          </div>
        `,
      });

      // Mark reminder as sent
      await supabase
        .from("bookings")
        .update({ reminder_sent: true })
        .eq("booking_id", booking.booking_id);

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for booking ${booking.booking_id}:`, err);
      failed.push(booking.booking_id);
    }
  }

  return res.status(200).json({ message: "Done.", sent, failed });
}
