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
// By default, Vite bundles everything into one JS file. Mapbox GL alone is
// ~900KB — it would delay the page even for users who never scroll to the map.
//
//   lazy(() => import('./components/LessonMap'))
//     → tells Vite to split LessonMap into its own separate chunk
//     → that chunk is only downloaded when LessonMap is about to render
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
} from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";

import Navbar from "./components/Navbar";
import Hook from "./components/Hook";
import Video from "./components/Video";
import About from "./components/About";
import Testimonial from "./components/Testimonial";
import CTA from "./components/CTA";
import SignupForm from "./components/SignupForm";
import Footer from "./components/Footer";
// import GlobalAudioPlayer from "./components/GlobalAudioPlayer";
import ContactForm from "./components/ContactForm";
import ErrorBoundary from "./components/ErrorBoundary";
import GiftLesson from "./components/GiftLesson";
import GiftSuccess from "./components/GiftSuccess";
import ChatWidget from "./components/ChatWidget";

import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import GiftRedeem from "./pages/GiftRedeem";

// lazy() + dynamic import() = code splitting.
// Vite creates a separate JS chunk for LessonMap that is only loaded when needed.
// mapbox-gl is ~900KB — this keeps the initial page load fast.
const LessonMap = lazy(() => import("./components/LessonMap"));

// Scrolls to the hash section after navigation (e.g. /#about from /signup).
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
  import.meta.env.VITE_SITE_URL ?? "https://handpan-lessons.vercel.app";

function HomePage() {
  return (
    <>
      <Hook />
      <About />
      <Video />
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
          <meta property="og:image" content={`${SITE_URL}/images/medya.png`} />
          <meta property="og:url" content={SITE_URL} />
        </Helmet>

        <ScrollToHash />
        <Navbar />
        {/* <GlobalAudioPlayer /> */}
        <ChatWidget />

        {/*
          Top-level ErrorBoundary catches any crash inside the route components.
          If HomePage or Signup throws during render, the app shows a fallback
          instead of a blank white screen.

          Route order matters — React Router matches top-to-bottom and stops
          at the first match. path="*" must be last.
        */}
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/gift" element={<GiftLesson />} />
            <Route path="/gift/success" element={<GiftSuccess />} />
            <Route path="/gift/redeem" element={<GiftRedeem />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
