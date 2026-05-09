// src/hooks/useInactivityTimeout.js
//
// Auto sign-out after N minutes of inactivity.
//
// HOW IT WORKS
//   We listen for a few "I'm still here" events on the window. Each one resets
//   a setTimeout. If the timeout fires (no event for N minutes), we call
//   supabase.auth.signOut() and redirect to /login?expired=true.
//
//   passive: true on the listeners means the browser can scroll/touch without
//   waiting for our handler — performance win, no behavioural difference here.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "click",
  "touchstart",
  "scroll",
];

export default function useInactivityTimeout(minutes = 30) {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    const ms = minutes * 60 * 1000;

    const expire = async () => {
      await supabase.auth.signOut();
      navigate("/login?expired=true", { replace: true });
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(expire, ms);
    };

    // Start the timer immediately on mount
    reset();

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, reset, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [minutes, navigate]);
}
