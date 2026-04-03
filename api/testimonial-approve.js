



import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


// What this taught you — the token pattern
// This is called a one-time action token and it shows up everywhere in real backends: email verification links, password reset links, unsubscribe links. The logic is always the same:

// 1.Generate a secret random value and store it with the record
// 2.Put it in a URL and send it to whoever should have authority to act
// 3.When the URL is hit, look up the token — if it exists, perform the action and delete the token
// 4.If the token is missing or already cleared, reject the request

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  // The token comes from the URL: /api/testimonial-approve?token=abc123
  // req.query is how you read query parameters in Vercel functions
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(renderPage("Invalid link.", false));
  }

  try {
    // Look for a row where approval_token matches AND it's not already approved.
    // If someone clicks the link twice, the second click finds nothing (token was cleared).
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, name")
      .eq("approval_token", token)
      .eq("approved", false)
      .single();

    if (error || !data) {
      // Either the token doesn't exist, or it was already used
      return res.status(404).send(renderPage("This link is invalid or has already been used.", false));
    }

    // Token matched — approve the row and clear the token so the link stops working
    const { error: updateError } = await supabase
      .from("testimonials")
      .update({
        approved: true,
        approval_token: null,   // single-use: clear it so the link dies
      })
      .eq("id", data.id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).send(renderPage("Something went wrong. Please try again.", false));
    }

    return res.status(200).send(renderPage(`Testimonial from ${data.name} is now live.`, true));
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).send(renderPage("Server error.", false));
  }
}

// Returns a simple HTML page so clicking the link in your email gives you
// a readable confirmation, not a raw JSON blob.
function renderPage(message, success) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${success ? "Approved" : "Error"}</title>
        <style>
          body {
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #FAFAF5;
          }
          .card {
            text-align: center;
            padding: 48px;
            border-radius: 24px;
            border: 1px solid #EBD5AB;
            background: white;
            max-width: 400px;
          }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #2D3B1F; font-size: 22px; margin: 0 0 12px; }
          p { color: #2D3B1F99; font-size: 15px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">${success ? "✅" : "❌"}</div>
          <h1>${success ? "Approved!" : "Something went wrong"}</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>
  `;
}