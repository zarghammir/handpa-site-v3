import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Creates a Supabase server client:
// 1.connect to Supabase
// 2.use the stronger server key
// 3.this happens only on the server
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  // accepts only POST requests, means if someone tries to visit this route the wrong way, reject it
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    // Reads the form data from the request
    const {
      full_name,
      email,
      phone,
      lesson_mode,
      in_person_location_type,
      student_address,
      experience_level,
      has_handpan,
      availability_preferences,
      message,
    } = req.body;

    if (!full_name || !email || !lesson_mode || !experience_level) {
      return res.status(400).json({
        message: "Please fill in all required fields.",
      });
    }

    if (lesson_mode === "in_person" && !in_person_location_type) {
      return res.status(400).json({
        message: "Please choose an in-person location option.",
      });
    }

    if (
      lesson_mode === "in_person" &&
      in_person_location_type === "student_place" &&
      !student_address
    ) {
      return res.status(400).json({
        message:
          "Please enter your address for in-person lessons at your place.",
      });
    }

    if (
      !Array.isArray(availability_preferences) ||
      availability_preferences.length === 0
    ) {
      return res.status(400).json({
        message: "Please choose at least one day and time range.",
      });
    }

    for (const slot of availability_preferences) {
      if (!slot.day || !slot.start || !slot.end) {
        return res.status(400).json({
          message: "Each selected day must include a start and end time.",
        });
      }

      if (slot.end <= slot.start) {
        return res.status(400).json({
          message: `For ${slot.day}, end time must be later than start time.`,
        });
      }
    }
    // Inserts data into Supabase, save a new row into the student_intakes table
    const { error } = await supabase.from("student_intakes").insert([
      {
        full_name,
        email,
        phone: phone || null,
        lesson_mode,
        in_person_location_type: in_person_location_type || null,
        student_address: student_address || null,
        experience_level,
        has_handpan,
        availability_preferences,
        message: message || null,
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        message: "Could not save your form. Please try again.",
      });
    }
    // 📩 Email to YOU
    await resend.emails.send({
      from: "Handpan <onboarding@resend.dev>",
      to: ["medy.tutoring@gmail.com"],
      subject: `New student intake from ${full_name}`,
      html: `
    <h2>New Student Intake</h2>
    <p><strong>Name:</strong> ${full_name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone || "N/A"}</p>
    <p><strong>Lesson Mode:</strong> ${lesson_mode}</p>
    <p><strong>Location:</strong> ${in_person_location_type || "N/A"}</p>
    <p><strong>Address:</strong> ${student_address || "N/A"}</p>
    <p><strong>Experience:</strong> ${experience_level}</p>
    <p><strong>Has Handpan:</strong> ${has_handpan ? "Yes" : "No"}</p>
    <pre>${JSON.stringify(availability_preferences, null, 2)}</pre>
    <p>${message || ""}</p>
  `,
    });

    // 💌 Email to student
//     await resend.emails.send({
//       from: "Medya Handpan <onboarding@resend.dev>",
//       to: [email],
//       subject: "Your handpan lesson request 🎵",
//       html: `
//     <h2>Hi ${full_name},</h2>
//     <p>Thank you for your interest in handpan lessons 🙏</p>
//     <p>I’ve received your request and will get back to you shortly.</p>
//     <p>Looking forward to starting your journey 🎶</p>
//     <p><strong>Medya</strong></p>
//   `,
//     });
    // after the data is inserted,it sends back JSON
    return res.status(200).json({
      message: "Your request has been submitted successfully.",
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      message: "Server error. Please try again.",
    });
  }
}
