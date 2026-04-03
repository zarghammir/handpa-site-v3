import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    // .eq("approved", true) is the key line.
    // This filter runs on the database, not in JavaScript.
    // Unapproved testimonials never leave the server.
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, name, country, text, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ message: "Could not fetch testimonials." });
    }

    return res.status(200).json({ testimonials: data });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}