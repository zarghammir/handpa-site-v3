// src/pages/ForgotPassword.jsx
//
// ─── What this teaches ────────────────────────────────────────────────────────
//
// PASSWORD RECOVERY (step 1 of 2)
//   supabase.auth.resetPasswordForEmail(email, { redirectTo })
//     → Supabase emails the user a one-time recovery link.
//     → The link contains a short-lived token and points to `redirectTo`.
//     → When the user clicks it, the Supabase client on that page detects the
//       recovery token in the URL hash and emits a PASSWORD_RECOVERY event,
//       at which point we can call updateUser({ password }).
//
// REDIRECT URL ALLOWLIST
//   Supabase will only honour redirectTo values that match the Redirect URLs
//   configured in: Supabase Dashboard → Authentication → URL Configuration.
//   Add `${VITE_SITE_URL}/reset-password` there for every environment you ship
//   to (localhost for dev, your prod domain for prod). Otherwise the link
//   falls back to SITE_URL and your reset page never loads.
//
// EMAIL ENUMERATION
//   We intentionally show the same success message whether or not the email
//   exists. Revealing "no account with that email" lets an attacker probe for
//   valid accounts. Supabase already behaves this way at the API level —
//   we mirror that in the UI copy.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const SITE_URL =
  import.meta.env.VITE_SITE_URL ?? window.location.origin;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${SITE_URL}/reset-password` }
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    // Always show the same confirmation, regardless of whether the email
    // matches a real account — see "Email enumeration" note above.
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">

        <div className="text-center mb-8 space-y-2">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            Password Reset
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-forest leading-tight">
            Forgot your <span className="text-sage">password</span>?
          </h1>
          <p className="text-forest/60 text-sm">
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="bg-sage/10 border border-sage/30 rounded-2xl px-5 py-4 text-sm text-forest/80 leading-relaxed">
                <p className="font-bold text-forest mb-1">Check your inbox</p>
                If an account exists for <strong>{email}</strong>, we just sent
                a password-reset link. The link expires in 1 hour.
              </div>
              <Link
                to="/login"
                className="inline-block w-full py-4 bg-forest text-cream font-bold rounded-2xl shadow-md hover:bg-sage hover:-translate-y-0.5 transition-all duration-300"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-forest text-cream font-bold rounded-2xl shadow-md hover:bg-sage hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? "Sending…" : "Send reset link →"}
              </button>

              <p className="text-center text-sm text-forest/60">
                Remembered it?{" "}
                <Link to="/login" className="text-orange font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
