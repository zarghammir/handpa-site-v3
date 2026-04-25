// src/components/HowItWorks.jsx
//
// Layout: 4 cards in a 2x2 grid + 1 full-width card below.
// Steps 1-4 sit in the grid, Step 5 spans full width.
// Add between <Video /> and <Testimonial /> in App.jsx.

import { useState, useEffect, useRef } from "react";

function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: "01",
    badge: "Free",
    title: "Book your free intro",
    body: "No experience, no commitment, no cost. Pick a time, show up, and meet Medya. That's all step one requires.",
    tag: "45 min · zero cost",
    accent: "#7C9E6B",
    bg: "bg-sage/10",
    border: "border-sage/25",
    badgeBg: "bg-sage/20 text-sage",
    Icon: () => (
      <svg viewBox="0 0 56 56" fill="none" className="w-12 h-12">
        <rect x="6" y="12" width="44" height="38" rx="7" fill="#7C9E6B" fillOpacity=".12" stroke="#7C9E6B" strokeWidth="1.2" strokeOpacity=".35"/>
        <rect x="6" y="12" width="44" height="12" rx="7" fill="#7C9E6B" fillOpacity=".2"/>
        <line x1="19" y1="8"  x2="19" y2="19" stroke="#7C9E6B" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="37" y1="8"  x2="37" y2="19" stroke="#7C9E6B" strokeWidth="1.8" strokeLinecap="round"/>
        <rect x="22" y="30" width="12" height="12" rx="4" fill="#7C9E6B" fillOpacity=".4"/>
        <text x="28" y="39" textAnchor="middle" fontSize="8" fontWeight="700" fill="#2D3B2D" fillOpacity=".6">✓</text>
        {[[13,32],[13,40],[43,32],[43,40]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="2" fill="#2D3B2D" fillOpacity=".12"/>
        ))}
      </svg>
    ),
  },
  {
    number: "02",
    badge: "Intro call",
    title: "Medya learns about you",
    body: "She listens first — your background, your goals, what music moves you. She meets you exactly where you are.",
    tag: "No judgment · tailored from day one",
    accent: "#E67E22",
    bg: "bg-orange/8",
    border: "border-orange/20",
    badgeBg: "bg-orange/15 text-orange",
    Icon: () => (
      <svg viewBox="0 0 56 56" fill="none" className="w-12 h-12">
        <rect x="6"  y="8"  width="26" height="18" rx="6" fill="#E67E22" fillOpacity=".18" stroke="#E67E22" strokeWidth="1.2" strokeOpacity=".4"/>
        <path d="M10 26 L6 32 L16 26Z" fill="#E67E22" fillOpacity=".18"/>
        <circle cx="15" cy="17" r="2" fill="#E67E22" fillOpacity=".5"/>
        <circle cx="21" cy="17" r="2" fill="#E67E22" fillOpacity=".5"/>
        <circle cx="27" cy="17" r="2" fill="#E67E22" fillOpacity=".5"/>
        <rect x="24" y="30" width="26" height="18" rx="6" fill="#2D3B2D" fillOpacity=".07" stroke="#2D3B2D" strokeWidth="1.2" strokeOpacity=".2"/>
        <path d="M46 48 L50 54 L40 48Z" fill="#2D3B2D" fillOpacity=".07"/>
        <line x1="30" y1="39" x2="44" y2="39" stroke="#2D3B2D" strokeWidth="1.5" strokeOpacity=".25" strokeLinecap="round"/>
        <line x1="30" y1="43" x2="40" y2="43" stroke="#2D3B2D" strokeWidth="1.5" strokeOpacity=".15" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: "03",
    badge: "Same session",
    title: "Play your first notes",
    body: "Right in the intro, you'll make real music. Not scales — an actual melody. The handpan guides you before technique does.",
    tag: "First melody in session 1",
    accent: "#2D3B2D",
    bg: "bg-forest/6",
    border: "border-forest/15",
    badgeBg: "bg-forest/12 text-forest",
    Icon: () => (
      <svg viewBox="0 0 56 56" fill="none" className="w-12 h-12">
        <circle cx="28" cy="28" r="20" fill="#2D3B2D" fillOpacity=".06" stroke="#2D3B2D" strokeWidth="1" strokeOpacity=".15"/>
        <circle cx="28" cy="28" r="7"  fill="#2D3B2D" fillOpacity=".08" stroke="#2D3B2D" strokeWidth=".8" strokeOpacity=".18"/>
        {[
          [28,10,true],[41,17,true],[46,30,false],
          [40,43,true],[28,48,false],[16,43,false],
          [10,30,false],[15,17,false],
        ].map(([x,y,active],i)=>(
          <circle key={i} cx={x} cy={y} r="5.5"
            fill={active?"#E67E22":"#2D3B2D"}
            fillOpacity={active?.3:.06}
            stroke={active?"#E67E22":"#2D3B2D"}
            strokeWidth=".8" strokeOpacity={active?.7:.2}/>
        ))}
        <circle cx="28" cy="10" r="9" stroke="#E67E22" strokeWidth=".8" strokeOpacity=".25" fill="none"/>
      </svg>
    ),
  },
  {
    number: "04",
    badge: "After intro",
    title: "Get your personal plan",
    body: "Based on what she learned, Medya designs a lesson path that fits your pace and goals. Meditative or performance-ready — both valid.",
    tag: "Weekly or bi-weekly · your pace",
    accent: "#7C9E6B",
    bg: "bg-sage/10",
    border: "border-sage/25",
    badgeBg: "bg-sage/20 text-sage",
    Icon: () => (
      <svg viewBox="0 0 56 56" fill="none" className="w-12 h-12">
        <path d="M8 48 Q16 32 28 28 Q40 24 48 10" stroke="#7C9E6B" strokeWidth="1.8" strokeOpacity=".4" fill="none" strokeLinecap="round" strokeDasharray="3 3"/>
        <circle cx="8"  cy="48" r="4" fill="#7C9E6B" fillOpacity=".2"  stroke="#7C9E6B" strokeWidth="1.2" strokeOpacity=".45"/>
        <circle cx="28" cy="28" r="4" fill="#7C9E6B" fillOpacity=".45" stroke="#7C9E6B" strokeWidth="1.2" strokeOpacity=".7"/>
        <circle cx="48" cy="10" r="5" fill="#7C9E6B" fillOpacity=".65" stroke="#7C9E6B" strokeWidth="1.4"/>
        <text x="48" y="14" textAnchor="middle" fontSize="6" fontWeight="700" fill="white" fillOpacity=".8">★</text>
        <circle cx="8" cy="40" r="3" fill="#2D3B2D" fillOpacity=".15"/>
        <path d="M5 48 Q8 44 11 48" fill="#2D3B2D" fillOpacity=".1"/>
      </svg>
    ),
  },
];

// The wide bottom card
const STEP_FIVE = {
  number: "05",
  badge: "Ongoing",
  title: "Show up, play, grow",
  body: "Each session builds on the last. Medya tracks your progress, adjusts as you evolve, and keeps lessons feeling alive — not like homework. Most students are playing full songs within their first month.",
  tag: "Full songs within month one · progress you can feel",
  accent: "#E67E22",
  bg: "bg-orange/8",
  border: "border-orange/20",
  badgeBg: "bg-orange/15 text-orange",
};

// ─── Grid card ────────────────────────────────────────────────────────────────

function GridCard({ step, delay }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`
        rounded-3xl border p-5 flex flex-col gap-3
        transition-all duration-600
        ${step.bg} ${step.border}
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Top row: icon + number */}
      <div className="flex items-start justify-between">
        <step.Icon />
        <span
          className="text-4xl font-black leading-none select-none"
          style={{ color: step.accent, opacity: 0.18 }}
        >
          {step.number}
        </span>
      </div>

      {/* Badge */}
      <span className={`self-start text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${step.badgeBg}`}>
        {step.badge}
      </span>

      {/* Text */}
      <h3 className="text-base font-black text-forest leading-snug">
        {step.title}
      </h3>
      <p className="text-xs text-forest/58 leading-relaxed flex-1">
        {step.body}
      </p>
      <p className="text-xs text-forest/30 font-semibold tracking-wide">
        {step.tag}
      </p>
    </div>
  );
}

// ─── Wide card ────────────────────────────────────────────────────────────────

function WideCard({ step, delay }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`
        rounded-3xl border p-6 md:p-8
        transition-all duration-600
        ${step.bg} ${step.border}
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-10">

        {/* Left: number + badge + title */}
        <div className="flex-shrink-0 flex items-center gap-5">
          <span
            className="text-6xl md:text-7xl font-black leading-none select-none"
            style={{ color: step.accent, opacity: 0.18 }}
          >
            {step.number}
          </span>
          <div className="flex flex-col gap-2">
            <span className={`self-start text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${step.badgeBg}`}>
              {step.badge}
            </span>
            <h3 className="text-xl md:text-2xl font-black text-forest leading-tight">
              {step.title}
            </h3>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px self-stretch bg-forest/10" />

        {/* Right: body + tag */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-forest/60 leading-relaxed mb-3">
            {step.body}
          </p>
          <p className="text-xs text-forest/30 font-semibold tracking-wide">
            {step.tag}
          </p>
        </div>

        {/* SVG growth chart — inline for the wide card */}
        <div className="hidden md:block flex-shrink-0">
          <svg viewBox="0 0 80 64" fill="none" className="w-20 h-16">
            <rect x="4"  y="48" width="12" height="12" rx="4" fill="#E67E22" fillOpacity=".2"  stroke="#E67E22" strokeWidth="1" strokeOpacity=".3"/>
            <rect x="20" y="36" width="12" height="24" rx="4" fill="#E67E22" fillOpacity=".35" stroke="#E67E22" strokeWidth="1" strokeOpacity=".5"/>
            <rect x="36" y="22" width="12" height="38" rx="4" fill="#E67E22" fillOpacity=".5"  stroke="#E67E22" strokeWidth="1" strokeOpacity=".65"/>
            <rect x="52" y="8"  width="12" height="52" rx="4" fill="#E67E22" fillOpacity=".7"  stroke="#E67E22" strokeWidth="1.2"/>
            <circle cx="58" cy="6" r="5" fill="#E67E22" fillOpacity=".3" stroke="#E67E22" strokeWidth="1"/>
            <text x="58" y="9.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="#E67E22">★</text>
            <line x1="2" y1="60" x2="68" y2="60" stroke="#2D3B2D" strokeWidth=".8" strokeOpacity=".12"/>
          </svg>
        </div>

      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function HowItWorks() {
  const [headerRef, headerInView] = useInView(0.2);

  return (
    <section id="how-it-works" className="bg-white px-4 py-16 sm:px-8 md:py-24">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div
          ref={headerRef}
          className={`text-center mb-10 transition-all duration-700 ${
            headerInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-block rounded-full bg-forest px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-cream mb-5">
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight text-forest mb-4">
            From first click to<br />
            <span className="text-sage">playing music</span>
          </h2>
          <p className="text-sm md:text-base text-forest/55 max-w-md mx-auto leading-relaxed">
            Five steps. The first one costs nothing and takes 45 minutes.
            The last one never ends.
          </p>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {STEPS.map((step, i) => (
            <GridCard key={step.number} step={step} delay={i * 80} />
          ))}
        </div>

        {/* Full-width card */}
        <WideCard step={STEP_FIVE} delay={320} />

        {/* CTA */}
        {/* <div className={`
          mt-10 text-center transition-all duration-700 delay-500
          ${headerInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}>
          <p className="text-sm text-forest/40 mb-4">
            Ready? Step 1 is free and takes 2 minutes to book.
          </p>
          <a
            href="#signup"
            className="inline-block rounded-2xl bg-orange px-8 py-4 text-sm font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-orange/90"
          >
            Book your free intro session →
          </a>
        </div> */}

      </div>
    </section>
  );
}