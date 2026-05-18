// Instructor profile tab — name + email display, avatar upload, and password
// reset via email. Uploads go to the `avatars` storage bucket at path
// `<user_id>/avatar.<ext>` (see migrations/06_profile_bio_avatar.sql for the
// bucket and RLS that scopes writes to the owning user).

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const SITE_URL = import.meta.env.VITE_SITE_URL ?? window.location.origin;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export default function InstructorProfileTab({ user }) {
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resetState, setResetState] = useState({ sending: false, message: null });
  const [feedback, setFeedback] = useState(null);

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    avatar_url: "",
  });

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile({
          full_name: data.full_name ?? "",
          email: data.email ?? user.email ?? "",
          avatar_url: data.avatar_url ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, [user.id, user.email]);

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      setFeedback({ type: "error", text: "Use a PNG, JPEG, or WEBP image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFeedback({ type: "error", text: "Image must be under 2 MB." });
      return;
    }

    setUploading(true);
    setFeedback(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase
      .storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      setFeedback({ type: "error", text: uploadErr.message });
      setUploading(false);
      return;
    }

    // Cache-bust the public URL so the new image shows immediately.
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateErr) {
      setFeedback({ type: "error", text: updateErr.message });
    } else {
      setProfile((p) => ({ ...p, avatar_url: publicUrl }));
      setFeedback({ type: "success", text: "Photo updated." });
    }
    setUploading(false);
  };

  const handlePasswordReset = async () => {
    setResetState({ sending: true, message: null });
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    setResetState({
      sending: false,
      message: error
        ? { type: "error", text: error.message }
        : { type: "success", text: `Reset link sent to ${profile.email}.` },
    });
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center text-forest/50 text-sm">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Avatar + identity */}
      <section className="bg-white rounded-3xl border border-sand p-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50 mb-4">
          Profile photo
        </h2>

        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-sand overflow-hidden flex items-center justify-center text-forest/30 font-bold text-2xl shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              profile.full_name?.[0]?.toUpperCase() ?? "?"
            )}
          </div>

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleAvatarPick}
              disabled={uploading}
              className="px-4 py-2 bg-forest text-cream font-bold rounded-xl hover:bg-sage transition-colors disabled:opacity-60 text-sm"
            >
              {uploading ? "Uploading..." : "Change photo"}
            </button>
            <p className="text-xs text-forest/40 mt-2">
              PNG, JPEG, or WEBP. Max 2 MB.
            </p>
          </div>
        </div>
      </section>

      {/* Account info */}
      <section className="bg-white rounded-3xl border border-sand p-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50 mb-4">
          Account
        </h2>
        <dl className="space-y-3 text-sm">
          <Row label="Name" value={profile.full_name || "—"} />
          <Row label="Email" value={profile.email} />
        </dl>
      </section>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Password */}
      <section className="bg-white rounded-3xl border border-sand p-6 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-forest/50">
          Password
        </h2>
        <p className="text-forest/60 text-sm">
          We'll email you a link to set a new password.
        </p>
        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={resetState.sending}
          className="px-5 py-3 bg-forest text-cream font-bold rounded-2xl hover:bg-sage transition-colors disabled:opacity-60"
        >
          {resetState.sending ? "Sending..." : "Send reset email"}
        </button>
        {resetState.message && (
          <p
            className={`text-sm font-medium ${
              resetState.message.type === "success" ? "text-green-700" : "text-red-700"
            }`}
          >
            {resetState.message.text}
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-forest/40">
        {label}
      </dt>
      <dd className="text-forest font-medium break-all">{value}</dd>
    </div>
  );
}
