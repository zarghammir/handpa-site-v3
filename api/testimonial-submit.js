import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const { name, country, text } = req.body;

    if (!name || !country || !text) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: "Testimonial must be under 500 characters." });
    }

    // Generate a random token — 32 bytes turned into a hex string (64 characters).
    // This is what makes the approval link secret and unguessable.
    const approvalToken = randomBytes(32).toString("hex");

    const { error } = await supabase
      .from("testimonials")
      .insert([
        {
          name: name.trim(),
          country: country.trim(),
          text: text.trim(),
          approved: false,
          approval_token: approvalToken,
        },
      ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ message: "Could not save your testimonial." });
    }

    // Build the approval link.
    // SITE_URL is an env variable you set in Vercel, e.g. https://your-site.vercel.app
    // This keeps the link correct in both development and production.
    const approvalLink = `${process.env.SITE_URL}/api/testimonial-approve?token=${approvalToken}`;

    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New testimonial from ${name} — approve?`,
      html: `
        <h2>New Testimonial Submitted</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p><strong>Message:</strong></p>
        <p>${text}</p>
        <br />
        <a
          href="${approvalLink}"
          style="
            display: inline-block;
            padding: 12px 24px;
            background: #E67E22;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          "
        >
          Approve this testimonial
        </a>
        <br /><br />
        <p style="color: #999; font-size: 12px;">
          This link works once and expires after use.
        </p>
      `,
    });

    return res.status(200).json({
      message: "Thank you! Your testimonial has been submitted for review.",
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}