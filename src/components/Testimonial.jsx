// src/components/Testimonial.jsx
//
// ─── What this replaces ───────────────────────────────────────────────────────
// The old paginated slider is gone. In its place: an elliptical 3D orbit of
// testimonial cards. Cards rotate slowly on their own. On desktop, mouse
// position tilts the orbit plane. Clicking/tapping a card expands it to read.
//
// ─── How the 3D orbit works ──────────────────────────────────────────────────
// Each card lives at a fixed angle on an ellipse (like planets on an orbit).
// We use CSS 3D transforms — not WebGL — because:
//   1. Text is pixel-perfect crisp (WebGL text is slightly blurry)
//   2. Native GPU acceleration with no library overhead
//   3. Works identically on mobile (auto-rotates, tap to read)
//
// The math:
//   x = cos(angle) * RX   (horizontal radius of ellipse)
//   z = sin(angle) * RZ   (depth radius — smaller = shallower orbit)
//   y = z * TILT          (cards higher/lower based on depth = 3D tilt feeling)
//
// rotateAngle advances every frame via requestAnimationFrame. Mouse position
// maps to a slight rotateX/rotateY on the container — the orbit plane itself
// appears to tilt toward the cursor.
//
// ─── Reduced motion ──────────────────────────────────────────────────────────
// If the user has prefers-reduced-motion set, auto-rotation stops and cards
// are shown in a simple responsive grid instead.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Country flag helper ──────────────────────────────────────────────────────
// Converts a country name to a flag emoji using regional indicator letters.
// "Netherlands" → looks up the ISO code → "🇳🇱"
const COUNTRY_CODES = {
  "netherlands": "nl", "canada": "ca", "united states": "us", "usa": "us",
  "uk": "gb", "united kingdom": "gb", "australia": "au", "germany": "de",
  "france": "fr", "spain": "es", "italy": "it", "japan": "jp",
  "brazil": "br", "mexico": "mx", "iran": "ir", "turkey": "tr",
  "sweden": "se", "norway": "no", "denmark": "dk", "finland": "fi",
  "switzerland": "ch", "austria": "at", "belgium": "be", "portugal": "pt",
  "poland": "pl", "israel": "il", "india": "in", "china": "cn",
  "south korea": "kr", "new zealand": "nz", "argentina": "ar",
};

function countryFlag(country) {
  if (!country) return "";
  const code = COUNTRY_CODES[country.toLowerCase().trim()];
  if (!code) return "";
  return code.toUpperCase().split("").map(
    c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}

// ─── Orbit constants ──────────────────────────────────────────────────────────
const RX           = 420;   // horizontal ellipse radius (px)
const RZ           = 130;   // depth radius
const Y_TILT       = 0.18;  // z → y tilt factor
const AUTO_SPEED   = 0.075; // degrees per frame (half the original 0.15)
const DRAG_SCALE   = 0.35;  // px dragged → degrees rotated
const DRAG_THRESH  = 5;     // px before a move is treated as a drag not a tap
const MOUSE_TILT   = 10;    // max degrees of mouse-driven tilt

// ─── SubmitForm ───────────────────────────────────────────────────────────────
function SubmitForm({ onClose }) {
  const [form, setForm] = useState({ name: "", country: "", text: "" });
  const [status, setStatus] = useState({ loading: false, success: "", error: "" });

  const handleSubmit = async () => {
    if (!form.name || !form.country || !form.text) return;
    setStatus({ loading: true, success: "", error: "" });
    try {
      const res = await fetch("/api/testimonial-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStatus({ loading: false, success: data.message, error: "" });
    } catch (e) {
      setStatus({ loading: false, success: "", error: e.message });
    }
  };

  return (
    <div className="mt-10 max-w-lg mx-auto bg-white rounded-3xl border border-sand p-6 md:p-8">
      {status.success ? (
        <div className="text-center py-4">
          <p className="text-forest font-bold text-lg mb-2">Thank you!</p>
          <p className="text-forest/60 text-sm">{status.success}</p>
          <button onClick={onClose} className="mt-4 text-sm text-orange font-semibold hover:underline">Close</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-forest font-bold text-lg">Share your experience</p>
          {[
            { key: "name", label: "Name", placeholder: "Your name" },
            { key: "country", label: "Country", placeholder: "Where are you from?" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-forest/50 uppercase tracking-widest mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-xl border border-forest/15 bg-cream px-3 py-2.5 text-sm text-forest placeholder:text-forest/30 outline-none focus:border-orange transition-colors"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-forest/50 uppercase tracking-widest mb-1">Your experience</label>
            <textarea
              value={form.text}
              onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
              placeholder="What was learning with Medya like?"
              rows={4}
              maxLength={500}
              className="w-full rounded-xl border border-forest/15 bg-cream px-3 py-2.5 text-sm text-forest placeholder:text-forest/30 outline-none focus:border-orange transition-colors resize-none"
            />
            <p className="text-xs text-forest/30 text-right mt-1">{form.text.length}/500</p>
          </div>
          {status.error && <p className="text-sm text-red-500">{status.error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={status.loading || !form.name || !form.country || !form.text}
              className="flex-1 py-2.5 bg-forest text-cream text-sm font-bold rounded-xl hover:bg-forest/90 transition-all disabled:opacity-40"
            >
              {status.loading ? "Submitting…" : "Submit"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-forest/50 hover:text-forest transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single orbit card ────────────────────────────────────────────────────────
function OrbitCard({ testimonial, angle, rotateAngle, isSelected, onTap }) {
  const rad = ((angle + rotateAngle) * Math.PI) / 180;
  const x = Math.cos(rad) * RX;
  const z = Math.sin(rad) * RZ;
  const y = z * Y_TILT;

  const normalizedZ = (z + RZ) / (2 * RZ);
  const scale   = 0.72 + normalizedZ * 0.28;
  const opacity = 0.45 + normalizedZ * 0.55;
  const zIndex  = Math.round(normalizedZ * 100);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%", top: "50%",
        transform: "translateX(-50%) translateY(-50%)",
        zIndex: isSelected ? 200 : zIndex,
        width: 240,
        pointerEvents: "auto",
      }}
    >
      <div
        onPointerUp={(e) => {
          // Stop the event reaching the container's onPointerUp
          // so container doesn't also fire its "tap on empty space" logic
          e.stopPropagation();
          onTap();
        }}
        style={{
          transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${isSelected ? 1.06 : scale})`,
          opacity: isSelected ? 1 : opacity,
          transition: "opacity 0.15s",
          cursor: "pointer",
          willChange: "transform",
        }}
      >
        <div className={`bg-white rounded-2xl border p-4 select-none ${
          isSelected
            ? "border-orange shadow-xl shadow-orange/10"
            : "border-sand"
        }`}>
          <span className="text-orange text-2xl font-black leading-none block mb-2">"</span>
          <p className={`text-forest/75 text-xs leading-relaxed ${isSelected ? "" : "line-clamp-3"}`}>
            {testimonial.text}
          </p>
          <div className="mt-3 pt-3 border-t border-sand/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sage/20 flex items-center justify-center text-xs font-black text-sage flex-shrink-0">
              {testimonial.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-forest truncate">{testimonial.name}</p>
              <p className="text-xs text-forest/40 truncate">
                {countryFlag(testimonial.country)} {testimonial.country}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile grid — 2 cards per row, stacked vertically ───────────────────────
function MobileSlider({ testimonials }) {
  const pairs = [];
  for (let i = 0; i < testimonials.length; i += 2) {
    pairs.push(testimonials.slice(i, i + 2));
  }

  return (
    <div className="flex flex-col gap-4">
      {pairs.map((pair, pi) => (
        <div key={pi} className="grid grid-cols-2 gap-3">
          {pair.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-sand p-4 flex flex-col">
              <span className="text-orange text-xl font-black leading-none block mb-2">"</span>
              <p className="text-forest/75 text-xs leading-relaxed flex-1">{t.text}</p>
              <div className="mt-3 pt-3 border-t border-sand/60 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-sage/20 flex items-center justify-center text-xs font-black text-sage flex-shrink-0">
                  {t.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-forest truncate">{t.name}</p>
                  <p className="text-xs text-forest/40">{countryFlag(t.country)}</p>
                </div>
              </div>
            </div>
          ))}
          {pair.length === 1 && <div />}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Testimonials() {
  const [testimonials,  setTestimonials]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [selectedId,    setSelectedId]    = useState(null);
  const [angle,         setAngle]         = useState(0);
  const [tilt,          setTilt]          = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth < 768);

  const raf        = useRef(null);
  const angleRef   = useRef(0);
  const paused     = useRef(false);
  const drag       = useRef(null);
  const wasDrag    = useRef(false);

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/testimonials-get")
      .then(r => r.json())
      .then(d => { if (d.success) setTestimonials(d.testimonials); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Auto-rotate loop ─────────────────────────────────────────────────────
  // Single rAF loop — always running but only advances when not paused.
  // Writing to angleRef avoids closure-stale-angle issues entirely.
  useEffect(() => {
    if (reducedMotion) return;
    function tick() {
      if (!paused.current) {
        angleRef.current = (angleRef.current + AUTO_SPEED) % 360;
        setAngle(angleRef.current);
      }
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [reducedMotion]);

  // ── Pointer down — only start drag if nothing is selected ────────────────
  const onDown = useCallback((e) => {
    if (e.button && e.button !== 0) return;
    if (selectedId !== null) return; // locked — card is open, ignore drag
    wasDrag.current = false;
    drag.current = { startX: e.clientX, startAngle: angleRef.current };
    paused.current = true;
  }, [selectedId]);

  // ── Pointer move ─────────────────────────────────────────────────────────
  const onMove = useCallback((e) => {
    if (selectedId !== null) return; // locked — ignore all movement
    if (!drag.current) {
      // Mouse tilt on desktop when not dragging
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      const ny = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
      setTilt({ x: ny * MOUSE_TILT, y: -nx * MOUSE_TILT });
      return;
    }
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > DRAG_THRESH) wasDrag.current = true;
    if (wasDrag.current) {
      const next = (drag.current.startAngle + dx * DRAG_SCALE) % 360;
      angleRef.current = next;
      setAngle(next);
    }
  }, [selectedId]);

  // ── Pointer up ───────────────────────────────────────────────────────────
  const onUp = useCallback(() => {
    // Mode A: card is open — any tap on empty space closes it and resumes
    if (selectedId !== null) {
      setSelectedId(null);
      paused.current = false;
      drag.current = null;
      return;
    }
    // Mode B: browsing — end drag and resume auto-rotate
    drag.current = null;
    wasDrag.current = false;
    paused.current = false;
  }, [selectedId]);

  const onLeave = useCallback(() => {
    drag.current = null;
    wasDrag.current = false;
    setTilt({ x: 0, y: 0 });
    if (selectedId === null) paused.current = false;
  }, [selectedId]);

  // ── Card tap ─────────────────────────────────────────────────────────────
  // The card calls e.stopPropagation() so this never conflicts with onUp
  const onCardTap = useCallback((id) => {
    setSelectedId(prev => {
      if (prev === id) {
        paused.current = false;
        return null;
      }
      paused.current = true;
      return id;
    });
  }, []);

  const angleStep = testimonials.length ? 360 / testimonials.length : 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section id="testimonials" className="py-12 md:py-20 px-4 sm:px-8 bg-cream">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
              What students say
            </h2>
            <div className="w-24 h-1 bg-orange mt-3 rounded-full mx-auto md:mx-0" />
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="self-center md:self-auto px-6 py-3 border-2 border-forest/20 text-forest text-sm font-bold rounded-2xl hover:bg-sand transition-all duration-200"
            >
              Share your experience →
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center gap-4 flex-wrap">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-56 h-40 rounded-2xl bg-sand/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && testimonials.length === 0 && (
          <p className="text-forest/40 text-center py-12">No testimonials yet.</p>
        )}

        {/* Mobile or reduced motion: paginated 2-card slider */}
        {!loading && testimonials.length > 0 && (reducedMotion || isMobile) && (
          <MobileSlider testimonials={testimonials} />
        )}

        {/* 3D orbit — desktop only */}
        {!loading && testimonials.length > 0 && !reducedMotion && !isMobile && (
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onLeave}
            onPointerCancel={onLeave}
            style={{
              perspective: "900px",
              perspectiveOrigin: "50% 50%",
              height: 420,
              position: "relative",
              cursor: selectedId !== null ? "default" : "grab",
              touchAction: "pan-y",
              userSelect: "none",
            }}
          >
            {/* Stage — tilts with mouse on desktop */}
            <div style={{
              width: "100%", height: "100%",
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 0.4s ease-out",
            }}>
              {testimonials.map((t, i) => (
                <OrbitCard
                  key={t.id}
                  testimonial={t}
                  angle={i * angleStep}
                  rotateAngle={angle}
                  isSelected={selectedId === t.id}
                  onTap={() => onCardTap(t.id)}
                />
              ))}
            </div>

            {/* Hint */}
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-forest/30 pointer-events-none select-none">
              {selectedId ? "tap anywhere to close · drag to spin" : "drag to spin · tap a card to read"}
            </p>
          </div>
        )}

        {showForm && <SubmitForm onClose={() => setShowForm(false)} />}

      </div>
    </section>
  );
}