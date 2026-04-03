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
    const { name, country, text } = req.body;

    // Server-side validation — never trust the frontend
    if (!name || !country || !text) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: "Testimonial must be under 500 characters." });
    }

    // approved is hardcoded to false here on the server.
    // The frontend has no say in this — even if someone manually
    // sent a POST request with approved: true, we ignore it.
    const { error } = await supabase.from("testimonials").insert([
      {
        name: name.trim(),
        country: country.trim(),
        text: text.trim(),
        approved: false,
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ message: "Could not save your testimonial." });
    }

    return res.status(200).json({
      message: "Thank you! Your testimonial has been submitted for review.",
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}