import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    console.log("User ID:", data.user.id);
    console.log("Profile data:", profile);
    console.log("Profile error:", profileError);

    if (profileError || !profile) {
      setError("Could not load user profile. Please try again.");
      setLoading(false);
      return;
    }
    if (profile.role === "instructor") {
      navigate("/dashboard/instructor");
    } else {
      navigate("/dashboard/student");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-forest mb-6">Sign In</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-sand rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-sage"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-sand rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-sage"
        />

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-forest text-white py-2 rounded-lg hover:bg-sage transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}
