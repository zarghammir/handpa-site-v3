// src/pages/Login.jsx
//
// ─── What this teaches ────────────────────────────────────────────────────────
//
// SESSION MANAGEMENT
//   supabase.auth.signInWithPassword() sends email + password to Supabase Auth.
//   On success, Supabase returns:
//     data.user    — the User object (id, email, role, metadata)
//     data.session — contains access_token (JWT) + refresh_token
//
//   The Supabase client stores this session in localStorage automatically.
//   On every page load, the client reads localStorage and restores the session.
//   This is why ProtectedRoute can call supabase.auth.getSession() synchronously
//   — it's reading from memory/localStorage, not making a network request.
//
// JWT (JSON Web Token)
//   The access_token is a JWT — a base64-encoded JSON object signed by Supabase.
//   It contains: user ID, email, role, expiry time.
//   Your frontend never calls your backend to check if the user is logged in —
//   it reads the JWT directly. The JWT expires (typically 1 hour), at which
//   point the Supabase client uses the refresh_token to get a new one silently.
//
// ROLE-BASED REDIRECT
//   After login, we read the role from the profiles table to decide where to
//   send the user. This is "authorisation after authentication":
//     authenticated? → yes → what role? → route to correct dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Read ?verified=pending from the URL — set by Signup.jsx when email
  // confirmation is required before the account becomes active.
  const [searchParams] = useSearchParams();
  const pendingVerification = searchParams.get("verified") === "pending";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // ── Step 1: Authenticate ─────────────────────────────────────────────────
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Common errors:
      //   "Invalid login credentials" → wrong email or password
      //   "Email not confirmed"       → user hasn't clicked the verification link
      setError(authError.message);
      setLoading(false);
      return;
    }

    // ── Step 2: Load profile for role-based redirect ─────────────────────────
    //
    // We query our profiles table (not auth.users) because that's where the
    // role lives. The RLS policy "students_read_own_profile" allows this —
    // auth.uid() in the policy matches data.user.id from the session.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      setError("Could not load your profile. Please try again.");
      setLoading(false);
      return;
    }

    // ── Step 3: Redirect based on role ───────────────────────────────────────
    if (profile.role === "instructor") {
      navigate("/dashboard/instructor");
    } else {
      navigate("/dashboard/student");
    }
  };

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            Welcome Back
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-forest leading-tight">
            Sign in to your <span className="text-sage">account</span>
          </h1>
          <p className="text-forest/60 text-sm">
            Don't have an account?{" "}
            <Link to="/Register" className="text-orange font-semibold hover:underline">
              Create one free
            </Link>
          </p>
        </div>

        {/* Email verification pending banner */}
        {pendingVerification && (
          <div className="mb-6 bg-sage/10 border border-sage/30 rounded-2xl px-5 py-4 text-sm text-forest/80 leading-relaxed">
            <p className="font-bold text-forest mb-1">Check your inbox</p>
            We sent a confirmation link to your email. Click it to activate your
            account, then sign in here.
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-5">

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

            <div>
              <label className="block text-sm font-bold text-forest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your password"
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
              {loading ? "Signing in…" : "Sign In →"}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-forest/40 mt-4">
          Your session stays active until you sign out.
        </p>
      </div>
    </div>
  );
}