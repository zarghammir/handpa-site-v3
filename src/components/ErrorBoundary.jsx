// ─── What is an Error Boundary? ──────────────────────────────────────────────
//
// Normally, if a React component throws an error during rendering, the entire
// app crashes and shows a blank white page. Error Boundaries are React's answer
// to this: a special component that catches errors from its children and shows
// a fallback UI instead.
//
// Key facts:
//   → Error Boundaries must be CLASS components — this is one of the very few
//     cases in modern React where you still need a class. Hooks can't catch
//     render errors (it's a React limitation).
//
//   → They catch errors in:
//       - render() of child components
//       - lifecycle methods of child components
//       - constructors of child components
//
//   → They do NOT catch:
//       - Errors in event handlers (use regular try/catch there)
//       - Async errors like fetch() failures (use try/catch in useEffect)
//       - Errors in the boundary itself
//
// The two lifecycle methods that make this work:
//
//   static getDerivedStateFromError(error)
//     Called during rendering when a child throws.
//     Returns new state — we set hasError: true to trigger the fallback UI.
//     This is a static method (no access to `this`) — it only updates state.
//
//   componentDidCatch(error, info)
//     Called after the error is caught.
//     Good place to log to an error tracking service (Sentry, etc).
//     info.componentStack shows you which component tree crashed.
//
// Usage:
//   Wrap any component that might fail:
//   <ErrorBoundary><LessonMap /></ErrorBoundary>
//
//   Or pass a custom fallback:
//   <ErrorBoundary fallback={<p>Map unavailable</p>}><LessonMap /></ErrorBoundary>
// ─────────────────────────────────────────────────────────────────────────────

import { Component } from "react";

export default class ErrorBoundary extends Component {
  // Initial state: no error has occurred
  state = { hasError: false };

  // Step 1: React calls this during rendering when a child throws.
  // Return value is merged into state — triggers a re-render with hasError: true.
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Step 2: React calls this after the error is caught and state is updated.
  // Good place to send error details to a monitoring service.
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    // Future: Sentry.captureException(error)
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback was passed as a prop, use it.
      // Otherwise show the default error UI.
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <p className="text-4xl mb-4">🎵</p>
            <h2 className="text-xl font-semibold text-forest mb-2">
              Something went wrong
            </h2>
            <p className="text-forest/60 text-sm mb-6">
              This section couldn&apos;t load. Try refreshing the page.
            </p>
            {/* "Try again" resets hasError to false, which re-renders the children */}
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-5 py-2 rounded-full bg-orange text-white text-sm font-medium hover:opacity-90 transition"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    // No error — render children normally
    return this.props.children;
  }
}
