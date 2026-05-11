// src/pages/ResetPassword.jsx
//
// ─── What this teaches ────────────────────────────────────────────────────────
//
// PASSWORD RECOVERY (step 2 of 2)
//   When the user clicks the email link, they land here with a recovery token
//   in the URL hash (e.g. #access_token=…&type=recovery). The Supabase client
//   detects this on mount, exchanges the token for a temporary session, and
//   fires onAuthStateChange with event === "PASSWORD_RECOVERY".
//
//   That temporary session is special: it only authorises a single call to
//   supabase.auth.updateUser({ password }). After we set the new password,
//   we sign the user out so they re-authenticate with the new credentials —
//   this is cleaner than auto-logging them in mid-recovery flow.
//
// onAuthStateChange
//   We subscribe in a useEffect and return data.subscription.unsubscribe so
//   React can clean up if the component unmounts. Without the cleanup, the
//   subscription would keep firing after the user navigates away.
//
// EXPIRED / INVALID LINK
//   If the user opens the page directly (no token) or after the link expired,
//   PASSWORD_RECOVERY never fires and getSession() returns null. We treat
//   that state as "link invalid" and offer to send a fresh one.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);      // recovery session detected?
  const [checking, setChecking] = useState(true); // still waiting on auth event
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // The Supabase client parses the URL hash on load. If a recovery token is
    // present it emits PASSWORD_RECOVERY synchronously, but we also check
    // getSession() so this works if the user refreshes after the token has
    // already been consumed into a session.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      setChecking(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Sign out of the recovery session and send the user to /login so they
    // sign in with the new password. Cleaner than leaving them in a half-
    // authenticated state on the dashboard.
    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => navigate("/login"), 2000);
  };

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md">

        <div className="text-center mb-8 space-y-2">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
            New Password
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-forest leading-tight">
            Choose a new <span className="text-sage">password</span>
          </h1>
        </div>

        <div className="bg-white rounded-3xl border border-sand p-8 shadow-sm">
          {checking ? (
            <p className="text-center text-forest/60 text-sm py-4">
              Verifying your reset link…
            </p>
          ) : done ? (
            <div className="bg-sage/10 border border-sage/30 rounded-2xl px-5 py-4 text-sm text-forest/80 leading-relaxed text-center">
              <p className="font-bold text-forest mb-1">Password updated</p>
              Redirecting you to sign in…
            </div>
          ) : !ready ? (
            <div className="space-y-4 text-center">
              <div className="bg-orange/10 border border-orange/30 rounded-2xl px-5 py-4 text-sm text-forest/80 leading-relaxed">
                <p className="font-bold text-forest mb-1">Link invalid or expired</p>
                Reset links are valid for 1 hour and can only be used once.
                Request a new one to continue.
              </div>
              <Link
                to="/forgot-password"
                className="inline-block w-full py-4 bg-forest text-cream font-bold rounded-2xl shadow-md hover:bg-sage hover:-translate-y-0.5 transition-all duration-300"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full rounded-2xl border border-forest/15 bg-cream px-4 py-3 text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Re-enter your new password"
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
                {loading ? "Updating…" : "Update password →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
