// ─── App.jsx — root of the React component tree ──────────────────────────────
//
// This file wires together routing, SEO, error handling, and lazy loading.
//
// ── React Router ──────────────────────────────────────────────────────────────
// React Router makes this a Single Page Application (SPA):
//   → Only one HTML file is ever loaded (index.html)
//   → When the URL changes, React Router swaps components — no full page reload
//   → <BrowserRouter> uses the History API (pushState) to manage URLs
//   → <Routes> looks at the current URL and renders the matching <Route>
//   → <Route path="*"> is the catch-all — matches any URL not matched above it
//
// ── Lazy loading + Suspense ───────────────────────────────────────────────────
// By default, Vite bundles everything into one JS file. three.js alone is
// ~700KB — it would delay the page even for users who never scroll that far.
//
//   lazy(() => import('./pages/Login'))
//     → tells Vite to split the page into its own separate chunk
//     → that chunk is only downloaded when the route is about to render
//
//   <Suspense fallback={...}>
//     → while the chunk downloads, renders the fallback (a skeleton)
//     → once downloaded, swaps in the real component
//
// ── SEO with react-helmet-async ───────────────────────────────────────────────
// React renders into a <div id="root"> — it doesn't touch the <head> tag by
// default. react-helmet-async lets you set <title>, <meta>, and other head tags
// from inside React components. Helmet merges all nested tags, with deeper ones
// taking precedence.
//
// import.meta.env.VITE_SITE_URL
//   This reads from your .env file at BUILD time (not runtime).
//   Variables starting with VITE_ are exposed to the browser bundle.
//   Variables without VITE_ (like RESEND_API_KEY) stay server-side only.
// ─────────────────────────────────────────────────────────────────────────────

import { Helmet } from "react-helmet-async";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { supabase } from "./lib/supabase";
import { lazy, Suspense, useEffect } from "react";

import Navbar from "./components/Navbar";
import Hook from "./components/Hook";
import Video from "./components/Video";
import About from "./components/About";
import Testimonial from "./components/Testimonial";
import CTA from "./components/CTA";
import SignupForm from "./components/SignupForm";
import Footer from "./components/Footer";
import ContactForm from "./components/ContactForm";
import ErrorBoundary from "./components/ErrorBoundary";
import ChatWidget from "./components/ChatWidget";
import ProtectedRoute from "./components/ProtectedRoute";
import HowItWorks from "./components/HowItWorks";

// lazy() + dynamic import() = code splitting: each of these becomes its own
// chunk that is only downloaded when its route (or scroll position) needs it.
// Homepage visitors no longer download the dashboards, auth pages, or the
// three.js-powered explorer up front — that alone halves the initial bundle.
const HandpanExplorer = lazy(() => import("./components/HandpanExplorer"));
const GiftLesson = lazy(() => import("./components/GiftLesson"));
const GiftSuccess = lazy(() => import("./components/GiftSuccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GiftRedeem = lazy(() => import("./pages/GiftRedeem"));
const Login = lazy(() => import("./pages/Login"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const InstructorDashboard = lazy(() => import("./pages/InstructorDashboard"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

// Minimal route-transition fallback — pages load in well under a second.
function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center text-forest/50">
      Loading…
    </div>
  );
}

// The public lead-gen chat assistant belongs on marketing pages only. On the
// dashboards it floated over the instructor's own tools (and collided with
// toasts); on auth pages it distracted from the task at hand.
const CHATLESS_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
]);

// If a password-recovery link lands anywhere other than /reset-password
// (e.g. Supabase's redirect allow-list rejects the path and falls back to
// the bare Site URL), the token still gets consumed on that page — the user
// ends up "logged in" on the homepage with no reset form in sight. Catch
// the PASSWORD_RECOVERY event globally and take them to the reset page.
function RecoveryRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && pathname !== "/reset-password") {
        navigate("/reset-password", { replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, pathname]);

  return null;
}

function SiteChat() {
  const { pathname } = useLocation();
  const lower = pathname.toLowerCase();
  if (lower.startsWith("/dashboard") || CHATLESS_PATHS.has(lower)) return null;
  return <ChatWidget />;
}

// Scrolls to the hash section after navigation (e.g. /#about from /register).
// React Router handles navigation in JS, so the browser won't auto-scroll.
function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    // Small delay lets the target page finish rendering before we scroll.
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timer);
  }, [location]);

  return null;
}

// Read the site URL from environment at build time.
// Falls back to a placeholder if VITE_SITE_URL isn't set.
const SITE_URL =
  import.meta.env.VITE_SITE_URL ?? "https://www.medyhandpan.com";

function HomePage() {
  return (
    <>
      <Hook />
      <About />
      <Video />
      <Suspense fallback={<RouteFallback />}>
        <HandpanExplorer />
      </Suspense>
      <HowItWorks />
      <Testimonial />
      <CTA />
      <SignupForm />
      <ContactForm />
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        {/*
          Helmet sets <head> tags from inside React.
          canonical tells search engines the "official" URL for this page.
          og:* (Open Graph) tags control how the link looks when shared on
          social media — title, description, and preview image.
        */}
        <Helmet>
          <title>Medya Handpan — Learn Handpan Online</title>
          <meta
            name="description"
            content="Learn handpan with Medya. Free 45-minute intro session. 500+ students worldwide. Book your session today."
          />
          <meta
            name="keywords"
            content="handpan lessons, learn handpan online, handpan teacher, handpan course"
          />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={SITE_URL} />
          <meta
            property="og:title"
            content="Medya Handpan — Learn Handpan Online"
          />
          <meta
            property="og:description"
            content="Free 45-minute intro session. Book now."
          />
          <meta property="og:image" content={`${SITE_URL}/images/medya-web.jpg`} />
          <meta property="og:url" content={SITE_URL} />
        </Helmet>

        <ScrollToHash />
        <RecoveryRedirect />
        <Navbar />
        <SiteChat />

        {/*
          Top-level ErrorBoundary catches any crash inside the route components.
          If HomePage or any route component throws during render, the app shows a fallback
          instead of a blank white screen.

          Route order matters — React Router matches top-to-bottom and stops
          at the first match. path="*" must be last.
        */}
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/gift" element={<GiftLesson />} />
            <Route path="/gift/success" element={<GiftSuccess />} />
            <Route path="/gift/redeem" element={<GiftRedeem />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute requiredRole="student" allowIncompleteOnboarding>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/instructor"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <InstructorDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
