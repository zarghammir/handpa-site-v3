// src/components/HandpanExplorer.jsx
//
// ─── Changes from original ────────────────────────────────────────────────────
//
//   REMOVED: The <svg> block with 2D circles and flat note labels
//   ADDED:   <HandpanCanvas> — the Three.js 3D instrument
//
//   Everything else is identical:
//   - All audio logic (Tone.js PolySynth, initAudio, playNote)
//   - All tab logic (explore / patterns / melody)
//   - All right-panel cards
//   - All pattern playback and melody generation
//
//   The key bridge is highlightNoteId:
//   - When a note plays (from a pattern or melody), we set highlightNoteId
//   - HandpanCanvas watches that prop and calls scene.highlightNote()
//   - The 3D field glows orange + ripple spawns
//
//   When the user taps a field directly in 3D:
//   - The scene calls onNoteClick(note)
//   - HandpanExplorer's handleNoteFromCanvas() plays the audio + updates infoNote
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";
import HandpanCanvas from "./HandpanCanvas";

// ─── Data ─────────────────────────────────────────────────────────────────────

const DING = {
  id: "ding",
  freq: 146.83,
  label: "Ding",
  displayName: "D — The Root",
  mood: "Grounding. This is home base. Every melody resolves back here.",
  role: "Root note",
};

const TONE_FIELDS = [
  {
    id: "tf1",
    freq: 220.0,
    label: "A",
    displayName: "A — The Fifth",
    mood: "Open and hopeful. The perfect partner for the Ding.",
    role: "5th — creates harmony",
  },
  {
    id: "tf2",
    freq: 233.08,
    label: "Bb",
    displayName: "Bb — The Minor Second",
    mood: "A little tension. Adds mystery and emotion to phrases.",
    role: "2nd — adds texture",
  },
  {
    id: "tf3",
    freq: 261.63,
    label: "C",
    displayName: "C — The Minor Third",
    mood: "Warm and bittersweet. The soul of the minor scale.",
    role: "3rd — defines the mood",
  },
  {
    id: "tf4",
    freq: 293.66,
    label: "D",
    displayName: "D — The Octave",
    mood: "Bright and uplifting. Same note as the Ding, one octave up.",
    role: "Octave — adds brightness",
  },
  {
    id: "tf5",
    freq: 329.63,
    label: "E",
    displayName: "E — The Second",
    mood: "Light and airy. Great for melodies that float.",
    role: "2nd — melodic movement",
  },
  {
    id: "tf6",
    freq: 349.23,
    label: "F",
    displayName: "F — The Minor Third (high)",
    mood: "Deep and resonant. Adds weight to a phrase.",
    role: "3rd — emotional depth",
  },
  {
    id: "tf7",
    freq: 392.0,
    label: "G",
    displayName: "G — The Fourth",
    mood: "Flowing and smooth. Bridges low and high effortlessly.",
    role: "4th — creates flow",
  },
  {
    id: "tf8",
    freq: 440.0,
    label: "A",
    displayName: "A — The High Fifth",
    mood: "Bright and soaring. The highest point of the scale.",
    role: "5th (high) — peaks & releases",
  },
];

const PATTERNS = [
  {
    id: "wave",
    name: "The Wave",
    desc: "Rise and fall — the most natural handpan phrase",
    tip: "Start low, climb up, come back home. Feel how it breathes.",
    steps: [
      { n: "ding", d: 0 },
      { n: "tf1", d: 500 },
      { n: "tf3", d: 1000 },
      { n: "tf4", d: 1500 },
      { n: "tf3", d: 2200 },
      { n: "tf1", d: 2700 },
      { n: "ding", d: 3200 },
    ],
  },
  {
    id: "heartbeat",
    name: "The Heartbeat",
    desc: "Two notes alternating — master the pulse",
    tip: "Two notes, steady rhythm. Space between notes is music too.",
    steps: [
      { n: "ding", d: 0 },
      { n: "tf4", d: 400 },
      { n: "ding", d: 800 },
      { n: "tf4", d: 1200 },
      { n: "ding", d: 1600 },
      { n: "tf4", d: 2000 },
      { n: "tf1", d: 2600 },
    ],
  },
  {
    id: "sunrise",
    name: "The Sunrise",
    desc: "Climb through the full D Kurd scale",
    tip: "Every note low to high — you're hearing the whole instrument.",
    steps: [
      { n: "ding", d: 0 },
      { n: "tf1", d: 600 },
      { n: "tf2", d: 1200 },
      { n: "tf3", d: 1800 },
      { n: "tf4", d: 2400 },
      { n: "tf5", d: 3000 },
      { n: "tf6", d: 3600 },
      { n: "tf7", d: 4200 },
      { n: "tf8", d: 4800 },
    ],
  },
];

const NOTE_MAP = { ding: DING };
TONE_FIELDS.forEach((n) => {
  NOTE_MAP[n.id] = n;
});
const ALL_NOTES = [DING, ...TONE_FIELDS];

function nameToSteps(name) {
  const chars = name
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 12);
  return chars.split("").map((ch, i) => {
    const idx = (ch.charCodeAt(0) - 65) % ALL_NOTES.length;
    return { n: ALL_NOTES[idx].id, d: i * 420, letter: ch };
  });
}

const SWIPE_THRESHOLD = 40;

// ─── Component ────────────────────────────────────────────────────────────────

export default function HandpanExplorer() {
  const [infoNote, setInfoNote] = useState(null);
  const [audioReady, setAudioReady] = useState(false);
  const [tab, setTab] = useState("melody");
  const [activePattern, setActivePattern] = useState(null);
  const [patternStep, setPatternStep] = useState(-1);
  const [patternPlaying, setPatternPlaying] = useState(false);
  const [patternIndex, setPatternIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null);

  const [melodyName, setMelodyName] = useState("");
  const [melodySteps, setMelodySteps] = useState([]);
  const [melodyPlaying, setMelodyPlaying] = useState(false);
  const [melodyStep, setMelodyStep] = useState(-1);
  const [melodyPlayed, setMelodyPlayed] = useState(false);

  const [highlightNoteId, setHighlightNoteId] = useState(null);

  const synthRef = useRef(null);
  const timersRef = useRef([]);
  const swipeStartX = useRef(null);
  const swipeLocked = useRef(false);

  // ── Audio ──────────────────────────────────────────────────────────────────

  const initAudio = useCallback(async () => {
    if (synthRef.current) return;
    try {
      const Tone = await import("tone");
      await Tone.start();
      const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.4 }).toDestination();
      await reverb.ready;
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        options: {
          oscillator: { type: "triangle8" },
          envelope: { attack: 0.005, decay: 0.8, sustain: 0.1, release: 2.5 },
          volume: -8,
        },
      }).connect(reverb);
      setAudioReady(true);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const playNote = useCallback(
    async (note, fromSequence = false) => {
      if (!synthRef.current) await initAudio();
      if (!synthRef.current) return;
      synthRef.current.triggerAttackRelease(note.freq, "2n");

      // Update the info panel (unless driven by a sequence — sequence sets its own)
      if (!fromSequence) setInfoNote(note);

      // Flash the 3D field
      setHighlightNoteId(note.id);
      setTimeout(() => setHighlightNoteId(null), 450);
    },
    [initAudio],
  );

  // ── Called when user taps a 3D field directly ─────────────────────────────
  const handleNoteFromCanvas = useCallback(
    async (note) => {
      await playNote(note, false);
      setInfoNote(note);
    },
    [playNote],
  );

  // ── Pattern playback ──────────────────────────────────────────────────────

  const playPattern = useCallback(
    async (pattern) => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (!synthRef.current) await initAudio();
      if (!synthRef.current) return;
      setActivePattern(pattern.id);
      setPatternPlaying(true);
      setPatternStep(0);
      setInfoNote(null);

      pattern.steps.forEach((step, i) => {
        const t = setTimeout(() => {
          const note = NOTE_MAP[step.n];
          if (note) {
            playNote(note, true);
            setPatternStep(i);
            // Drive the 3D highlight
            setHighlightNoteId(note.id);
            setTimeout(() => setHighlightNoteId(null), 380);
          }
          if (i === pattern.steps.length - 1) {
            setTimeout(() => {
              setPatternPlaying(false);
              setPatternStep(-1);
              setActivePattern(null);
            }, 1200);
          }
        }, step.d);
        timersRef.current.push(t);
      });
    },
    [initAudio, playNote],
  );

  const stopPattern = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPatternPlaying(false);
    setPatternStep(-1);
    setActivePattern(null);
    setHighlightNoteId(null);
  }, []);

  // ── Melody playback ───────────────────────────────────────────────────────

  const playMelody = useCallback(
    async (steps) => {
      if (!steps.length) return;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (!synthRef.current) await initAudio();
      if (!synthRef.current) return;
      setMelodyPlaying(true);
      setMelodyStep(0);
      setMelodyPlayed(true);

      steps.forEach((step, i) => {
        const t = setTimeout(() => {
          const note = NOTE_MAP[step.n];
          if (note) {
            playNote(note, true);
            setMelodyStep(i);
            setHighlightNoteId(note.id);
            setTimeout(() => setHighlightNoteId(null), 380);
          }
          if (i === steps.length - 1) {
            setTimeout(() => {
              setMelodyPlaying(false);
              setMelodyStep(-1);
            }, 1200);
          }
        }, step.d);
        timersRef.current.push(t);
      });
    },
    [initAudio, playNote],
  );

  const stopMelody = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setMelodyPlaying(false);
    setMelodyStep(-1);
    setHighlightNoteId(null);
  }, []);

  const handleMelodySubmit = useCallback(() => {
    const trimmed = melodyName.trim();
    if (!trimmed) return;
    const steps = nameToSteps(trimmed);
    setMelodySteps(steps);
    playMelody(steps);
  }, [melodyName, playMelody]);

  const goToPattern = useCallback(
    (nextIdx) => {
      stopPattern();
      setPatternIndex(nextIdx);
    },
    [stopPattern],
  );

  const handleSwipeStart = useCallback((clientX) => {
    swipeStartX.current = clientX;
    swipeLocked.current = false;
  }, []);

  const handleSwipeEnd = useCallback((clientX) => {
    if (swipeStartX.current === null || swipeLocked.current) return;
    const delta = clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    swipeLocked.current = true;
    const dir = delta < 0 ? "left" : "right";
    setSwipeDir(dir);
    setTimeout(() => {
      setPatternIndex((prev) =>
        dir === "left"
          ? (prev + 1) % PATTERNS.length
          : (prev - 1 + PATTERNS.length) % PATTERNS.length,
      );
      setSwipeDir(null);
    }, 150);
  }, []);

  const currentPattern = PATTERNS[patternIndex];

  const isCurrentPlaying =
    activePattern === currentPattern?.id && patternPlaying;

  const cardStyle = swipeDir
    ? {
        transform: `translateX(${swipeDir === "left" ? -20 : 20}px)`,
        opacity: 0,
        transition: "all 0.15s ease-out",
      }
    : {
        transform: "translateX(0)",
        opacity: 1,
        transition: "all 0.15s ease-out",
      };

  // ── Melody step colors ────────────────────────────────────────────────────
  function melodyNoteColor(i) {
    if (!melodyPlaying)
      return melodyPlayed
        ? "bg-sage/10 text-sage border-sage/20"
        : "bg-forest/5 text-forest/40 border-forest/10";
    if (i === melodyStep) return "bg-orange text-white border-orange";
    if (i < melodyStep) return "bg-forest/10 text-forest/50 border-forest/10";
    return "bg-forest/5 text-forest/35 border-forest/10";
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      id="explorer"
      className="pt-10 pb-8 md:py-16 px-4 sm:px-8 bg-cream overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* ── Section header ── */}
        <div className="text-center mb-6">
          <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full mb-3">
            Try it now
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
            Play a real <span className="text-orange">handpan</span>
          </h2>
          <p className="mt-2 text-forest/50 text-sm md:text-base max-w-md mx-auto">
            Drag to rotate · tap any field to hear it · every note sounds good
            together
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex justify-center mb-5">
          <div className="inline-flex rounded-2xl border border-sand bg-white p-1 gap-1">
            {[
              { id: "explore", label: "Explore" },
              { id: "patterns", label: "Patterns" },
              { id: "melody", label: "Your Name" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  stopPattern();
                  stopMelody();
                }}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                  tab === id
                    ? "bg-forest text-cream shadow-sm"
                    : "text-forest/50 hover:text-forest"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main layout ──
             Desktop: handpan LEFT, cards RIGHT, equal 50/50
             Mobile:  handpan TOP, cards BELOW (natural DOM order)
        ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
          {/* ── 3D Handpan — LEFT on desktop, TOP on mobile ── */}
          <div className="w-full md:w-1/2 flex flex-col items-center">
            <HandpanCanvas
              onNoteClick={handleNoteFromCanvas}
              highlightNoteId={highlightNoteId}
              className="w-full h-[300px] md:h-[420px]"
            />
            <p className="mt-1 text-center text-xs text-forest/35">
              {tab === "melody" && melodyPlayed
                ? "Your name, lit up on the handpan ✦"
                : !audioReady
                  ? "Tap any field to begin"
                  : "Drag to rotate · tap to play"}
            </p>
          </div>

          {/* ── Cards panel — RIGHT on desktop, BELOW on mobile ── */}
          <div className="w-full md:w-1/2 md:pt-22">
            {/* EXPLORE TAB */}
            {tab === "explore" && (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-sand bg-white p-4 min-h-[130px] flex flex-col justify-center">
                  {infoNote ? (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-sage/20 flex items-center justify-center text-sm font-black text-sage">
                          {infoNote.label}
                        </div>
                        <div>
                          <p className="font-black text-sm text-forest leading-tight">
                            {infoNote.displayName}
                          </p>
                          <p className="text-xs text-forest/40 font-semibold uppercase tracking-wide">
                            {infoNote.role}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-forest/65 italic border-l-2 border-sage/40 pl-3 mb-3">
                        "{infoNote.mood}"
                      </p>
                      <div className="flex items-center gap-1">
                        {ALL_NOTES.map((n) => (
                          <div
                            key={n.id}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-200 ${
                              n.id === infoNote.id
                                ? "bg-orange"
                                : "bg-forest/10"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs text-forest/30 mb-2">
                        ← Tap a tone field
                      </p>
                      <p className="text-xs text-forest/45 leading-relaxed">
                        Each note shows its name, role in the scale, and what it
                        feels like
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-sage/8 border border-sage/15 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-sage/70 mb-1.5">
                    D Kurd scale
                  </p>
                  <p className="text-xs text-forest/60 leading-relaxed">
                    All 9 notes belong to the same scale — any combination
                    sounds musical. That's the handpan's secret. It's designed
                    for beginners.
                  </p>
                </div>
              </div>
            )}

            {/* PATTERNS TAB */}
            {tab === "patterns" && (
              <div className="flex flex-col gap-3">
                <div
                  onPointerDown={(e) => handleSwipeStart(e.clientX)}
                  onPointerUp={(e) => handleSwipeEnd(e.clientX)}
                  onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
                  onTouchEnd={(e) =>
                    handleSwipeEnd(e.changedTouches[0].clientX)
                  }
                  style={{
                    touchAction: "pan-y",
                    cursor: "grab",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={cardStyle}
                    className={`rounded-2xl border p-4 ${
                      isCurrentPlaying
                        ? "border-orange/40 bg-orange/5"
                        : "border-sand bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-forest leading-tight">
                          {currentPattern.name}
                        </p>
                        <p className="text-xs text-forest/45 mt-0.5 leading-tight">
                          {currentPattern.desc}
                        </p>
                      </div>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() =>
                          isCurrentPlaying
                            ? stopPattern()
                            : playPattern(currentPattern)
                        }
                        className={`flex-shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          isCurrentPlaying
                            ? "bg-orange/10 text-orange border border-orange/30"
                            : "bg-forest text-cream hover:bg-forest/90"
                        }`}
                      >
                        {isCurrentPlaying ? "Stop" : "Play"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {currentPattern.steps.map((step, i) => {
                        const isLit = isCurrentPlaying && i === patternStep;
                        const isPast = isCurrentPlaying && i < patternStep;
                        return (
                          <span
                            key={i}
                            className={`rounded-md px-2 py-0.5 text-xs font-bold transition-all duration-150 ${
                              isLit
                                ? "bg-orange text-white"
                                : isPast
                                  ? "bg-sage/15 text-sage"
                                  : "bg-forest/8 text-forest/45"
                            }`}
                          >
                            {NOTE_MAP[step.n]?.label}
                          </span>
                        );
                      })}
                    </div>

                    <p className="text-xs text-forest/50 italic leading-relaxed border-l-2 border-sage/30 pl-3">
                      {currentPattern.tip}
                    </p>
                  </div>
                </div>

                {/* Pattern nav dots */}
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() =>
                      goToPattern(
                        (patternIndex - 1 + PATTERNS.length) % PATTERNS.length,
                      )
                    }
                    className="text-forest/40 hover:text-forest text-lg transition-colors px-2"
                  >
                    ‹
                  </button>
                  <div className="flex gap-1.5">
                    {PATTERNS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => goToPattern(i)}
                        className={`h-1.5 rounded-full transition-all duration-200 ${
                          i === patternIndex
                            ? "bg-orange w-5"
                            : "bg-forest/20 w-1.5"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      goToPattern((patternIndex + 1) % PATTERNS.length)
                    }
                    className="text-forest/40 hover:text-forest text-lg transition-colors px-2"
                  >
                    ›
                  </button>
                </div>

                <div className="rounded-2xl bg-sage/8 border border-sage/15 p-3">
                  <p className="text-xs text-forest/55 leading-relaxed">
                    ← Swipe to browse · tap Play · watch the 3D handpan light up
                  </p>
                </div>
              </div>
            )}

            {/* MELODY TAB */}
            {tab === "melody" && (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-sand bg-white p-4">
                  <p className="text-xs font-bold text-forest/50 uppercase tracking-widest mb-3">
                    Type your name
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={melodyName}
                      onChange={(e) => {
                        setMelodyName(e.target.value);
                        setMelodyPlayed(false);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleMelodySubmit()
                      }
                      placeholder="e.g. Medya"
                      maxLength={12}
                      className="flex-1 rounded-xl border border-forest/15 bg-cream px-3 py-2 text-sm text-forest placeholder:text-forest/30 outline-none focus:border-orange transition-colors"
                    />
                    <button
                      onClick={melodyPlaying ? stopMelody : handleMelodySubmit}
                      disabled={!melodyName.trim() && !melodyPlaying}
                      className="rounded-xl px-4 py-2 text-sm font-bold transition-all bg-forest text-cream hover:bg-forest/90 disabled:opacity-40"
                    >
                      {melodyPlaying ? "Stop" : "Play"}
                    </button>
                  </div>
                </div>

                {melodySteps.length > 0 && (
                  <div className="rounded-2xl border border-sand bg-white p-4">
                    <p className="text-xs font-bold text-forest/40 uppercase tracking-widest mb-2">
                      Your melody
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {melodySteps.map((step, i) => (
                        <span
                          key={i}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-all duration-150 ${melodyNoteColor(i)}`}
                        >
                          {step.letter} → {NOTE_MAP[step.n]?.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-sage/8 border border-sage/15 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-sage/70 mb-1.5">
                    How it works
                  </p>
                  <p className="text-xs text-forest/60 leading-relaxed">
                    Each letter maps to one of the 9 notes. Same name, same
                    melody — always. Watch the 3D handpan light up as your name
                    plays.
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* end cards panel */}
        </div>
        {/* end main layout */}
      </div>
    </section>
  );
}
