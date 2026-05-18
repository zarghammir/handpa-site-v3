// src/components/UserMenu.jsx
//
// Gmail-style top-right avatar button + dropdown.
// Click the avatar circle → a small panel drops down showing the user's name
// and email, with "Profile" and "Log out" actions.
//
// PROPS
//   user         — Supabase auth user (uses .email as fallback display)
//   profile      — { full_name, avatar_url } from the `profiles` row
//   onOpenProfile() — invoked when the user clicks "Profile"
//   onSignOut()    — invoked when the user clicks "Log out"

import { useEffect, useRef, useState } from "react";

export default function UserMenu({ user, profile, onOpenProfile, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close on outside click / Escape so the menu feels like a real popover.
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const name = profile?.full_name?.trim();
  const email = user?.email ?? "";
  const initial =
    (name?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full overflow-hidden bg-sand flex items-center justify-center text-forest font-bold text-base border border-sand hover:ring-2 hover:ring-orange/40 transition"
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={name || email || "Account"}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white border border-sand rounded-2xl shadow-lg z-30 overflow-hidden"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-sand">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-sand flex items-center justify-center text-forest font-bold text-lg shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="min-w-0">
              {name && (
                <p className="font-bold text-forest truncate">{name}</p>
              )}
              <p className="text-sm text-forest/60 truncate">{email}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenProfile?.();
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold text-forest hover:bg-cream transition-colors"
            >
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut?.();
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold text-forest hover:bg-cream transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
