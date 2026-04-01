import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Please fill in all fields.",
      });
    }

    const { error } = await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: "medy.tutoring@gmail.com",
      subject: `New message from ${name}`,
      replyTo: email,
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({
        message: error.message || "Email failed to send.",
      });
    }

    return res.status(200).json({
      message: "Message sent successfully.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: err.message || "Server error.",
    });
  }
}