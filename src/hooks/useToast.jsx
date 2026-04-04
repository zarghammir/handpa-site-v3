// ─── What this file teaches ──────────────────────────────────────────────────
//
// This implements a "toast notification" system from scratch using two
// important React patterns: Context and custom hooks.
//
// ── React Context ─────────────────────────────────────────────────────────────
// Problem: you want to show a toast from ContactForm, but the toast container
// lives at the top of the app (in main.jsx). How do you pass a "show toast"
// function down through every component in between? That's called "prop drilling"
// and it gets messy fast.
//
// Solution: React Context. Think of it like a global variable that any component
// can read, without passing it as a prop through every level.
//
//   createContext()    → creates the "channel"
//   <Context.Provider> → puts a value on the channel for all children
//   useContext()       → any child reads from the channel
//
// ── Custom Hooks ─────────────────────────────────────────────────────────────
// A custom hook is just a function that starts with "use" and calls other hooks
// inside it. Here, useToast() is a convenience wrapper around useContext()
// that also gives a helpful error if you forget to wrap the app in ToastProvider.
//
// ── How it all fits together ─────────────────────────────────────────────────
//
//   main.jsx wraps the app in <ToastProvider>
//     ↓ provides { show, dismiss, toasts } to all children
//
//   ContactForm calls:
//     const { show } = useToast()
//     show("Message sent!", "success")
//
//   ToastContainer (also in main.jsx) reads:
//     const { toasts } = useToast()
//     → renders the current list of toasts
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback } from "react";

// The context object — a "channel" for sharing toast state across the tree.
// The default value (null) is only used if someone calls useToast()
// outside of a <ToastProvider> — we detect that and throw a clear error.
const ToastContext = createContext(null);

// Counter for unique toast IDs — simple module-level integer, not state,
// because we don't need React to re-render when it increments.
let idCounter = 0;

/**
 * Wrap your app in this provider once (in main.jsx).
 * It manages the list of active toasts and exposes show/dismiss to all children.
 */
export function ToastProvider({ children }) {
  // toasts is an array of { id, message, type } objects
  const [toasts, setToasts] = useState([]);

  // useCallback memoizes the function so it doesn't change identity on every render.
  // This matters because `dismiss` is a dependency of `show` below.
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, type = "success", duration = 4000) => {
      const id = ++idCounter; // unique ID for this toast
      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto-dismiss after `duration` milliseconds
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  // Provide { show, dismiss, toasts } to the entire component tree below
  return (
    <ToastContext.Provider value={{ show, dismiss, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Custom hook — call this inside any component to get the toast API.
 *
 * Usage:
 *   const { show } = useToast()
 *   show("Sent!", "success")          // green toast
 *   show("Something broke", "error")  // red toast
 */
export function useToast() {
  const ctx = useContext(ToastContext);

  // Fail fast with a clear message rather than a confusing "cannot read property of null"
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");

  return ctx;
}
