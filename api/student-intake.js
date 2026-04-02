import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
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

    if (
      lesson_mode === "in_person" &&
      !in_person_location_type
    ) {
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
        message: "Please enter your address for in-person lessons at your place.",
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