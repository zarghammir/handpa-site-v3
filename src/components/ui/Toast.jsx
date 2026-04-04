// ─── What this file teaches ──────────────────────────────────────────────────
//
// This is the visual output half of the toast system — it reads the toast list
// from Context (via useToast) and renders it.
//
// Key concepts:
//
// role="region" + aria-label
//   Marks this container as a named landmark region for screen readers.
//   Screen reader users can navigate to "Notifications" directly.
//
// role="alert"
//   Tells screen readers to announce this content immediately when it appears,
//   without the user having to navigate to it. This is the correct ARIA role
//   for toast notifications.
//
// Conditional rendering
//   `if (toasts.length === 0) return null` — React renders nothing for null.
//   This means the container DOM element is completely absent when there are
//   no toasts, rather than being empty and invisible.
//
// Fixed positioning (fixed bottom-6 right-6)
//   The container stays in the bottom-right corner of the viewport regardless
//   of scroll position. z-50 ensures it appears above all other content.
//
// The dismiss button
//   Calls dismiss(toast.id) which filters that toast out of the state array
//   in useToast.jsx — no DOM manipulation, just state updates.
// ─────────────────────────────────────────────────────────────────────────────

import { useToast } from "../../hooks/useToast.jsx";

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  // Render nothing when there are no toasts — keeps the DOM clean
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert" // screen readers announce this immediately when it appears
          className={`flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium
            ${toast.type === "success"
              ? "bg-forest text-cream"
              : "bg-red-600 text-white"
            }`}
        >
          <span className="mt-0.5 shrink-0">
            {toast.type === "success" ? "✓" : "✕"}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 opacity-60 hover:opacity-100 transition"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
