// src/pages/Signup.jsx
//
// ─── What this teaches ────────────────────────────────────────────────────────
//
// AUTHENTICATION vs AUTHORISATION
//   Authentication = "who are you?" — proving identity with credentials
//   Authorisation  = "what can you do?" — checking permissions after login
//   This page handles authentication: creating a new identity in Supabase Auth.
//
// HOW SUPABASE AUTH WORKS
//   Supabase Auth is a managed identity service built on top of PostgreSQL.
//   When you call supabase.auth.signUp(), two things happen:
//     1. A row is created in auth.users (a Supabase-managed table you can't
//        touch directly — it stores hashed passwords, email verification state)
//     2. Supabase fires an onAuthStateChange event and returns a session
//        (a JWT access token + a refresh token)
//
//   The JWT is stored in localStorage by the Supabase client automatically.
//   On every subsequent page load, the client reads it and restores the session
//   without the user having to log in again.
//
// THE PROFILES TABLE
//   auth.users only stores auth data (email, password hash, provider).
//   Your app needs more: full name, role (student vs instructor), phone, etc.
//   The standard pattern is a `profiles` table in your public schema that has
//   a 1:1 relationship with auth.users, linked by the same UUID.
//
//   We insert into profiles right after signUp — that's the "registration" step.
//   If signUp succeeds but the profiles insert fails, the user can auth but has
//   no profile. The fix is a Postgres trigger (see the SQL migration).
//
// PASSWORDS
//   We never see or store the password — it goes directly to Supabase Auth's
//   API, which bcrypt-hashes it before writing to auth.users. We only ever
//   compare hashes, never plaintext.
//
// EMAIL VERIFICATION
//   By default Supabase sends a confirmation email before the account is active.
//   You can disable this in the Supabase dashboard for development.
//   For production, you'd want it enabled — unverified emails are a spam vector.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Register() {
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Field helper ───────────────────────────────────────────────────────────
  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side validation — always validate on the server too, but fast
    // feedback in the UI is better UX than waiting for a round trip.
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // ── Step 1: Create the auth user ───────────────────────────────────────
      //
      // supabase.auth.signUp() calls POST /auth/v1/signup on Supabase's auth
      // service. Supabase hashes the password (bcrypt), creates a row in
      // auth.users, and returns:
      //   data.user    — the new User object (id, email, created_at, etc.)
      //   data.session — a JWT session if email confirmation is disabled,
      //                  or null if the user needs to confirm their email first
      //
      // options.data = additional metadata stored on the auth user object itself
      // (accessible via data.user.user_metadata). We also store full_name in
      // profiles below — but having it here too means it's always on the token.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name },
        },
      });

      if (authError) {
        // Common errors:
        //   "User already registered"  → email already in auth.users
        //   "Password should be at least 6 characters" → Supabase minimum
        setError(authError.message);
        setLoading(false);
        return;
      }

      // ── Step 2: Insert into profiles table ────────────────────────────────
      //
      // auth.users is managed by Supabase and not directly queryable from the
      // client. We maintain a parallel `profiles` table in the public schema
      // for app-specific data: full name, role, phone, etc.
      //
      // authData.user.id is the UUID that links profiles → auth.users.
      // This UUID is the same one that shows up in supabase.auth.getUser()
      // and is the basis for all Row Level Security policies.
      //
      // NOTE: If email confirmation is ON, authData.session is null and
      // authData.user.confirmed_at is null. The insert below still works
      // because we're using the service role... wait, no — we're using the
      // anon key on the client. So RLS must allow inserts from the user's own
      // session OR we need a trigger. See the SQL migration for the trigger
      // approach, which is more robust.
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: authData.user.id, // same UUID as auth.users — this is the FK
          full_name: form.full_name,
          email: form.email,
          role: "student",      // all self-registered users are students
        },
      ]);

      if (profileError) {
        // The auth user was created but the profile insert failed.
        // This is an edge case — log it but don't block the user.
        // A Postgres trigger (in the SQL migration) handles this as a fallback.
        console.error("Profile insert error:", profileError);
        // Don't return here — the auth succeeded, so we can still redirect.
        // The profile will be created by the trigger.
      }

      // ── Step 3: Redirect ───────────────────────────────────────────────────
      //
      // If email confirmation is disabled (common in dev), signUp also signs
      // the user in immediately, so navigate straight to the dashboard.
      //
      // If email confirmation is ON, the session is null and we should show
      // a "check your email" message instead.
      if (authData.session) {
        // Signed in immediately — go to dashboard
        navigate("/dashboard/student");
      } else {
        // Email confirmation required — tell the user to check their inbox
        navigate("/login?verified=pending");
      }
    } catch (err) {
      console.error("Unexpected signup error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            Create Account
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-forest leading-tight">
            Start your <span className="text-sage">journey</span>
          </h1>
          <p className="text-forest/60 text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-orange font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm">
          <form onSubmit={handleSignup} className="space-y-5">

            {/* Full name */}
            <div>
              <label className="block text-sm font-bold text-forest mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                placeholder="Your full name"
                className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-forest mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-forest mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="At least 8 characters"
                className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-bold text-forest mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Repeat your password"
                className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-orange text-white font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Creating account…" : "Create Account →"}
            </button>

          </form>
        </div>

        {/* Privacy note */}
        <p className="text-center text-xs text-forest/40 mt-4">
          Your information is never shared with third parties.
        </p>
      </div>
    </div>
  );
}