import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_lib/cors.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { ok, err } from "./_lib/response.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== "GET") {
    return err(res, 405, "Method not allowed.");
  }

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "testimonials-get", 30, 60); // 30/minute
  if (!allowed) {
    return err(res, 429, "Too many requests. Please try again later.");
  }

  try {
    // .eq("approved", true) — unapproved testimonials never leave the server
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, name, country, text, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return err(res, 500, "Could not fetch testimonials.");
    }

    return ok(res, { testimonials: data });
  } catch (e) {
    console.error("Server error:", e);
    return err(res, 500, "Server error. Please try again.");
  }
}
