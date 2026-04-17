// src/components/HandpanExplorer.jsx
//
// ─── What this teaches ────────────────────────────────────────────────────────
//
// WEB AUDIO API (via Tone.js)
//   PolySynth + Reverb chain, lazy-loaded on first interaction.
//   Tone.start() must be called inside a user gesture (iOS requirement).
//
// SWIPE GESTURE — onPointerDown / onPointerUp
//   We track the X position on pointerdown and compare it on pointerup.
//   If the delta is > 40px, it counts as a swipe left or right.
//   We use useRef for the start position (not useState) because we don't
//   need a re-render — we just need the value available at pointerup time.
//   This is the same pattern used in every mobile carousel / drawer.
//
// PATTERN PLAYBACK WITH setTimeout
//   A chain of setTimeouts sequences notes. Timeout IDs stored in a ref
//   so we can cancel them if the user swipes mid-pattern.
//
// REF vs STATE
//   synthRef, timersRef, swipeStartX — none of these need re-renders.
//   Everything that changes the UI (activeNote, patternStep, etc.) is state.
//
// NAME → MELODY ALGORITHM
//   Each letter maps deterministically to one of the 9 notes (A–Z → index 0–8
//   via charCode mod 9). Same name always produces the same melody — no
//   randomness. This is a pure function: nameToSteps(name) → steps[].
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";

const DING = {
  id: "ding", freq: 146.83, label: "Ding",
  displayName: "D — The Root",
  mood: "Grounding. This is home base. Every melody resolves back here.",
  role: "Root note",
};

const TONE_FIELDS = [
  { id:"tf1", freq:220.0,  label:"A",  displayName:"A — The Fifth",              mood:"Open and hopeful. The perfect partner for the Ding.",          role:"5th — creates harmony"         },
  { id:"tf2", freq:233.08, label:"Bb", displayName:"Bb — The Minor Second",      mood:"A little tension. Adds mystery and emotion to phrases.",       role:"2nd — adds texture"            },
  { id:"tf3", freq:261.63, label:"C",  displayName:"C — The Minor Third",        mood:"Warm and bittersweet. The soul of the minor scale.",           role:"3rd — defines the mood"        },
  { id:"tf4", freq:293.66, label:"D",  displayName:"D — The Octave",             mood:"Bright and uplifting. Same note as the Ding, one octave up.",  role:"Octave — adds brightness"      },
  { id:"tf5", freq:329.63, label:"E",  displayName:"E — The Second",             mood:"Light and airy. Great for melodies that float.",               role:"2nd — melodic movement"        },
  { id:"tf6", freq:349.23, label:"F",  displayName:"F — The Minor Third (high)", mood:"Deep and resonant. Adds weight to a phrase.",                  role:"3rd — emotional depth"         },
  { id:"tf7", freq:392.0,  label:"G",  displayName:"G — The Fourth",             mood:"Flowing and smooth. Bridges low and high effortlessly.",       role:"4th — creates flow"            },
  { id:"tf8", freq:440.0,  label:"A",  displayName:"A — The High Fifth",         mood:"Bright and soaring. The highest point of the scale.",          role:"5th (high) — peaks & releases" },
];

const PATTERNS = [
  {
    id: "wave", name: "The Wave",
    desc: "Rise and fall — the most natural handpan phrase",
    tip: "Start low, climb up, come back home. Feel how it breathes.",
    steps: [
      {n:"ding",d:0},{n:"tf1",d:500},{n:"tf3",d:1000},{n:"tf4",d:1500},
      {n:"tf3",d:2200},{n:"tf1",d:2700},{n:"ding",d:3200},
    ],
  },
  {
    id: "heartbeat", name: "The Heartbeat",
    desc: "Two notes alternating — master the pulse",
    tip: "Two notes, steady rhythm. Space between notes is music too.",
    steps: [
      {n:"ding",d:0},{n:"tf4",d:400},{n:"ding",d:800},{n:"tf4",d:1200},
      {n:"ding",d:1600},{n:"tf4",d:2000},{n:"tf1",d:2600},
    ],
  },
  {
    id: "sunrise", name: "The Sunrise",
    desc: "Climb through the full D Kurd scale",
    tip: "Every note low to high — you're hearing the whole instrument.",
    steps: [
      {n:"ding",d:0},{n:"tf1",d:600},{n:"tf2",d:1200},{n:"tf3",d:1800},
      {n:"tf4",d:2400},{n:"tf5",d:3000},{n:"tf6",d:3600},{n:"tf7",d:4200},{n:"tf8",d:4800},
    ],
  },
];

const NOTE_MAP = { ding: DING };
TONE_FIELDS.forEach((n) => { NOTE_MAP[n.id] = n; });
const ALL_NOTES = [DING, ...TONE_FIELDS];

function nameToSteps(name) {
  const chars = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
  return chars.split("").map((ch, i) => {
    const idx = (ch.charCodeAt(0) - 65) % ALL_NOTES.length;
    return { n: ALL_NOTES[idx].id, d: i * 420, letter: ch };
  });
}

const CX = 160, CY = 160, R = 108;
const FIELD_POS = TONE_FIELDS.map((note, i) => {
  const angle = ((i * 360) / TONE_FIELDS.length - 90) * (Math.PI / 180);
  return { ...note, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
});

const SWIPE_THRESHOLD = 40;

export default function HandpanExplorer() {
  const [activeNote,      setActiveNote]     = useState(null);
  const [infoNote,        setInfoNote]       = useState(null);
  const [audioReady,      setAudioReady]     = useState(false);
  const [tab,             setTab]            = useState("melody");
  const [activePattern,   setActivePattern]  = useState(null);
  const [patternStep,     setPatternStep]    = useState(-1);
  const [patternPlaying,  setPatternPlaying] = useState(false);
  const [patternIndex,    setPatternIndex]   = useState(0);
  const [swipeDir,        setSwipeDir]       = useState(null);

  const [melodyName,      setMelodyName]     = useState("");
  const [melodySteps,     setMelodySteps]    = useState([]);
  const [melodyPlaying,   setMelodyPlaying]  = useState(false);
  const [melodyStep,      setMelodyStep]     = useState(-1);
  const [melodyPlayed,    setMelodyPlayed]   = useState(false);

  // hint dismissed permanently once user clicks the melody tab
  const [showHint, setShowHint] = useState(true);

  const synthRef    = useRef(null);
  const timersRef   = useRef([]);
  const swipeStartX = useRef(null);
  const swipeLocked = useRef(false);

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
    } catch (e) { console.error(e); }
  }, []);

  const playNote = useCallback(async (note, fromPattern = false) => {
    if (!synthRef.current) await initAudio();
    if (!synthRef.current) return;
    synthRef.current.triggerAttackRelease(note.freq, "2n");
    setActiveNote(note.id);
    if (!fromPattern) setInfoNote(note);
    setTimeout(() => setActiveNote((p) => p === note.id ? null : p), 450);
  }, [initAudio]);

  const playPattern = useCallback(async (pattern) => {
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
        if (note) { playNote(note, true); setPatternStep(i); }
        if (i === pattern.steps.length - 1)
          setTimeout(() => { setPatternPlaying(false); setPatternStep(-1); setActivePattern(null); }, 1200);
      }, step.d);
      timersRef.current.push(t);
    });
  }, [initAudio, playNote]);

  const stopPattern = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPatternPlaying(false);
    setPatternStep(-1);
    setActivePattern(null);
  }, []);

  const playMelody = useCallback(async (steps) => {
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
        if (note) { playNote(note, true); setMelodyStep(i); }
        if (i === steps.length - 1)
          setTimeout(() => { setMelodyPlaying(false); setMelodyStep(-1); }, 1200);
      }, step.d);
      timersRef.current.push(t);
    });
  }, [initAudio, playNote]);

  const stopMelody = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setMelodyPlaying(false);
    setMelodyStep(-1);
  }, []);

  const handleMelodySubmit = useCallback(() => {
    const trimmed = melodyName.trim();
    if (!trimmed) return;
    const steps = nameToSteps(trimmed);
    setMelodySteps(steps);
    playMelody(steps);
  }, [melodyName, playMelody]);

  const goToPattern = useCallback((nextIdx) => {
    stopPattern();
    setPatternIndex(nextIdx);
  }, [stopPattern]);

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
          : (prev - 1 + PATTERNS.length) % PATTERNS.length
      );
      stopPattern();
      setSwipeDir(null);
    }, 200);
  }, [stopPattern]);

  const noteColor = (id) => {
    if (activeNote === id) return "#E67E22";
    if (infoNote?.id === id) return "#7C9E6B";
    const pat = activePattern ? PATTERNS.find(p => p.id === activePattern) : null;
    if (pat && patternPlaying && patternStep >= 0 && pat.steps[patternStep]?.n === id)
      return "#E67E22";
    if (melodyPlaying && melodyStep >= 0 && melodySteps[melodyStep]?.n === id)
      return "#E67E22";
    if (tab === "melody" && !melodyPlaying && melodyPlayed && melodySteps.some(s => s.n === id))
      return "#A6B28B";
    return null;
  };

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    if (synthRef.current) synthRef.current.dispose();
  }, []);

  useEffect(() => {
    if (tab !== "melody") { stopMelody(); }
    if (tab !== "patterns") { stopPattern(); }
  }, [tab, stopMelody, stopPattern]);

  const currentPattern   = PATTERNS[patternIndex];
  const isCurrentPlaying = activePattern === currentPattern.id && patternPlaying;

  const cardStyle = {
    opacity:   swipeDir ? 0 : 1,
    transform: swipeDir === "left"  ? "translateX(-20px)"
             : swipeDir === "right" ? "translateX(20px)"
             : "translateX(0)",
    transition: swipeDir
      ? "opacity 0.18s ease-out, transform 0.18s ease-out"
      : "opacity 0.18s ease-in,  transform 0.18s ease-in",
  };

  return (
    <section className="bg-cream px-4 py-12 sm:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">

        {/* Keyframes for pulse badge ring + nudge line */}
        <style>{`
          @keyframes hp-pulse {
            0%   { opacity: 0.8; transform: scale(0.6); }
            70%  { opacity: 0;   transform: scale(1.9); }
            100% { opacity: 0;   transform: scale(1.9); }
          }
          @keyframes hp-nudge {
            0%,  15% { opacity: 0; transform: translateY(4px);  }
            35%, 70% { opacity: 1; transform: translateY(0);     }
            88%,100% { opacity: 0; transform: translateY(-3px);  }
          }
        `}</style>

        {/* Header */}
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-forest px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-cream mb-4">
            Try It Yourself
          </span>
          <h2 className="mb-2 text-3xl font-black leading-tight text-forest sm:text-4xl">
            Hear the <span className="text-sage">handpan</span>
          </h2>
          <p className="text-sm text-forest/55 max-w-lg mx-auto">
            Every note is already in tune with every other. You literally cannot make it sound bad.
          </p>
        </div>

        {/* Tab switcher — identical markup + classes to original.
            Only addition: position:relative on the melody button so the
            pulse badge can be absolutely positioned inside it. */}
        <div className="mx-auto mb-2 flex max-w-xs rounded-xl border border-sand bg-sand/30 p-1">
          {["melody", "patterns", "explore"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                stopPattern();
                stopMelody();
                setInfoNote(null);
                if (t === "melody") setShowHint(false);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all duration-200 ${
                tab === t ? "bg-forest text-cream" : "text-forest/45 hover:text-forest"
              }`}
              style={t === "melody" ? { position: "relative" } : undefined}
            >
              {t === "melody" ? "Your Melody" : t === "patterns" ? "Patterns" : "Free play"}

              {/* A — Pulse badge: 7px orange dot, ring expands outward */}
              {t === "melody" && showHint && (
                <span style={{
                  position: "absolute", top: 5, right: 5,
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#E67E22", display: "block",
                  pointerEvents: "none",
                }}>
                  <span style={{
                    position: "absolute", inset: -3,
                    borderRadius: "50%",
                    border: "1.5px solid #E67E22",
                    animation: "hp-pulse 1.8s ease-out infinite",
                  }} />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* C — Nudge line: fixed 20px height so layout never shifts.
            Fades in/out on a loop. Gone the moment hint is dismissed. */}
        <div className="mx-auto mb-6 flex max-w-xs items-center justify-center" style={{ height: 20 }}>
          {showHint && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              opacity: 0, pointerEvents: "none",
              animation: "hp-nudge 3.5s ease-in-out 0.9s infinite",
            }}>
              <span style={{ display: "inline-block", width: 14, height: 1, background: "#E67E22", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#E67E22", fontStyle: "italic" }}>
                type your name, hear it played
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse items-center gap-5 md:flex-row md:items-center md:gap-8">

          {/* ── Handpan SVG ── */}
          <div className="flex-shrink-0 flex flex-col items-center w-full max-w-[280px] md:w-[400px] md:max-w-[400px]">
            <svg viewBox="0 0 320 320" className="w-full select-none"
              style={{ touchAction: "none" }}
              role="img" aria-label="Interactive handpan — tap to play">
              <circle cx={CX} cy={CY} r="148" fill="#3a4a3a" fillOpacity="0.05"
                stroke="#2D3B2D" strokeWidth="1" strokeOpacity="0.12" />
              <circle cx={CX} cy={CY} r="50" fill="none" stroke="#2D3B2D"
                strokeWidth="0.5" strokeOpacity="0.1" strokeDasharray="3 3" />

              {FIELD_POS.map((note) => {
                const col = noteColor(note.id); const on = !!col;
                return (
                  <g key={note.id}
                    onPointerDown={(e) => { e.preventDefault(); playNote(note); }}
                    className="cursor-pointer" tabIndex={0}
                    onKeyDown={(e) => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); playNote(note); } }}
                  >
                    <circle cx={note.x} cy={note.y} r="22"
                      fill={col||"#2D3B2D"} fillOpacity={on?0.18:0.05}
                      stroke={col||"#2D3B2D"} strokeWidth={on?1.5:0.7} strokeOpacity={on?0.85:0.22}
                      style={{transition:"all 0.15s ease-out"}} />
                    <circle cx={note.x} cy={note.y} r="7" fill="none"
                      stroke={col||"#2D3B2D"} strokeWidth="0.4" opacity={on?0.4:0.1}
                      style={{transition:"all 0.15s ease-out"}} />
                    <text x={note.x} y={note.y+1} textAnchor="middle" dominantBaseline="central"
                      fill={col||"#2D3B2D"} fillOpacity={on?0.9:0.4}
                      fontSize="9" fontWeight="600" fontFamily="inherit"
                      style={{transition:"all 0.15s ease-out",pointerEvents:"none"}}>
                      {note.label}
                    </text>
                  </g>
                );
              })}

              {(() => {
                const col = noteColor("ding"); const on = !!col;
                return (
                  <g onPointerDown={(e) => { e.preventDefault(); playNote(DING); }}
                    className="cursor-pointer" tabIndex={0}
                    onKeyDown={(e) => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); playNote(DING); } }}
                  >
                    <circle cx={CX} cy={CY} r="30"
                      fill={col||"#2D3B2D"} fillOpacity={on?0.15:0.05}
                      stroke={col||"#2D3B2D"} strokeWidth={on?1.5:0.7} strokeOpacity={on?0.85:0.22}
                      style={{transition:"all 0.15s ease-out"}} />
                    <circle cx={CX} cy={CY} r="11" fill="none"
                      stroke={col||"#2D3B2D"} strokeWidth="0.4" opacity={on?0.4:0.1}
                      style={{transition:"all 0.15s ease-out"}} />
                    <text x={CX} y={CY+1} textAnchor="middle" dominantBaseline="central"
                      fill={col||"#2D3B2D"} fillOpacity={on?0.9:0.45}
                      fontSize="10" fontWeight="700" fontFamily="inherit"
                      style={{transition:"all 0.15s ease-out",pointerEvents:"none"}}>
                      Ding
                    </text>
                  </g>
                );
              })()}
            </svg>

            <p className="mt-1 text-center text-xs text-forest/35">
              {tab === "melody" && melodyPlayed
                ? "Your name, lit up on the handpan ✦"
                : !audioReady
                ? "Tap any field to begin"
                : "Any combo works, explore and enjoy :)"}
            </p>
          </div>

          {/* ── Right panel ── */}
          <div className="flex-1 w-full min-w-0">

            {/* FREE PLAY */}
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
                          <p className="font-black text-sm text-forest leading-tight">{infoNote.displayName}</p>
                          <p className="text-xs text-forest/40 font-semibold uppercase tracking-wide">{infoNote.role}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-forest/65 italic border-l-2 border-sage/40 pl-3 mb-3">
                        "{infoNote.mood}"
                      </p>
                      <div className="flex items-center gap-1">
                        {ALL_NOTES.map((n) => (
                          <div key={n.id}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-200 ${
                              n.id===infoNote.id ? "bg-orange" : "bg-forest/10"
                            }`} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs text-forest/30 mb-2">← Tap a tone field</p>
                      <p className="text-xs text-forest/45 leading-relaxed">
                        Each note shows its name, role in the scale, and what it feels like
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-sage/8 border border-sage/15 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-sage/70 mb-1.5">D Kurd scale</p>
                  <p className="text-xs text-forest/60 leading-relaxed">
                    All 9 notes belong to the same scale — any combination sounds musical.
                    That's the handpan's secret. It's designed for beginners.
                  </p>
                </div>
              </div>
            )}

            {/* PATTERNS — swipeable single card */}
            {tab === "patterns" && (
              <div className="flex flex-col gap-3">

                <div
                  onPointerDown={(e) => handleSwipeStart(e.clientX)}
                  onPointerUp={(e) => handleSwipeEnd(e.clientX)}
                  onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
                  onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
                  style={{ touchAction: "pan-y", cursor: "grab", userSelect: "none" }}
                >
                  <div
                    style={cardStyle}
                    className={`rounded-2xl border p-4 ${
                      isCurrentPlaying ? "border-orange/40 bg-orange/5" : "border-sand bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-forest leading-tight">{currentPattern.name}</p>
                        <p className="text-xs text-forest/45 mt-0.5 leading-tight">{currentPattern.desc}</p>
                      </div>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => isCurrentPlaying ? stopPattern() : playPattern(currentPattern)}
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
                        const isLit  = isCurrentPlaying && i === patternStep;
                        const isPast = isCurrentPlaying && i < patternStep;
                        return (
                          <span key={i}
                            className={`rounded-md px-2 py-0.5 text-xs font-bold transition-all duration-150 ${
                              isLit  ? "bg-orange text-white" :
                              isPast ? "bg-orange/20 text-orange/70" :
                                       "bg-forest/8 text-forest/35"
                            }`}
                          >
                            {NOTE_MAP[step.n]?.label}
                          </span>
                        );
                      })}
                    </div>

                    {isCurrentPlaying && (
                      <div className="flex gap-1 mb-3">
                        {currentPattern.steps.map((_, i) => (
                          <div key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-150 ${
                              i === patternStep ? "bg-orange" :
                              i < patternStep   ? "bg-orange/30" : "bg-forest/10"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    <div className="bg-sage/8 rounded-xl px-3 py-2">
                      <p className="text-xs text-forest/60 leading-relaxed">
                        <span className="font-bold text-sage">Lesson: </span>
                        {currentPattern.tip}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => goToPattern((patternIndex - 1 + PATTERNS.length) % PATTERNS.length)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-forest/15 text-lg text-forest/40 transition-all hover:border-forest/30 hover:text-forest/70"
                    aria-label="Previous pattern"
                  >‹</button>

                  <div className="flex items-center gap-3">
                    {PATTERNS.map((p, i) => (
                      <button key={p.id} onClick={() => goToPattern(i)}
                        className="flex flex-col items-center gap-1 group"
                        aria-label={`Go to ${p.name}`}
                      >
                        <div className={`rounded-full transition-all duration-200 ${
                          i === patternIndex ? "w-5 h-2 bg-forest" : "w-2 h-2 bg-forest/20 group-hover:bg-forest/40"
                        }`} />
                        <span className={`text-xs transition-all duration-200 ${
                          i === patternIndex ? "text-forest/60 font-semibold" : "text-forest/20"
                        }`}>
                          {p.name.replace("The ", "")}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => goToPattern((patternIndex + 1) % PATTERNS.length)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-forest/15 text-lg text-forest/40 transition-all hover:border-forest/30 hover:text-forest/70"
                    aria-label="Next pattern"
                  >›</button>
                </div>

                <p className="text-xs text-center text-forest/30">
                  Swipe or tap arrows to switch · Listen first, then try it yourself
                </p>
              </div>
            )}

            {/* YOUR MELODY */}
            {tab === "melody" && (
              <div className="flex flex-col gap-3">

                <div className={`rounded-2xl border p-4 transition-all duration-300 ${
                  melodyPlaying ? "border-orange/40 bg-orange/5" : "border-sand bg-white"
                }`}>
                  <p className="font-black text-sm text-forest mb-0.5">Your name as a handpan melody</p>
                  <p className="text-xs text-forest/45 mb-4 leading-snug">
                    Each letter maps to a unique note. Type your name and hear what it sounds like.
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={melodyName}
                      onChange={(e) => {
                        setMelodyName(e.target.value);
                        setMelodyPlayed(false);
                        setMelodySteps([]);
                        stopMelody();
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleMelodySubmit(); }}
                      placeholder="e.g. Medya"
                      maxLength={15}
                      className="flex-1 min-w-0 rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm text-forest placeholder:text-forest/30 outline-none focus:border-orange transition-colors"
                    />
                    <button
                      onClick={melodyPlaying ? stopMelody : handleMelodySubmit}
                      disabled={!melodyName.trim() && !melodyPlaying}
                      className={`flex-shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-40 ${
                        melodyPlaying
                          ? "bg-orange/10 text-orange border border-orange/30"
                          : "bg-forest text-cream hover:bg-forest/90"
                      }`}
                    >
                      {melodyPlaying ? "Stop" : melodyPlayed ? "Again ↻" : "Play ▶"}
                    </button>
                  </div>
                </div>

                {melodySteps.length > 0 && (
                  <div className="rounded-2xl border border-sand bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-sage/70 mb-3">
                      {melodyName.trim().toUpperCase().replace(/[^A-Z]/gi, "").slice(0, 12).split("").join(" · ")}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {melodySteps.map((step, i) => {
                        const note = NOTE_MAP[step.n];
                        const isLit  = melodyPlaying && i === melodyStep;
                        const isPast = melodyPlaying && i < melodyStep;
                        return (
                          <div key={i} className="flex flex-col items-center gap-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-wider transition-all duration-150 ${
                              isLit ? "text-orange" : isPast ? "text-orange/40" : "text-forest/25"
                            }`}>
                              {step.letter}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-xs font-bold transition-all duration-150 ${
                              isLit  ? "bg-orange text-white scale-110" :
                              isPast ? "bg-orange/20 text-orange/70" :
                                       "bg-forest/8 text-forest/40"
                            }`}>
                              {note?.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {melodyPlaying && (
                      <div className="flex gap-1">
                        {melodySteps.map((_, i) => (
                          <div key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-150 ${
                              i === melodyStep ? "bg-orange" :
                              i < melodyStep   ? "bg-orange/30" : "bg-forest/10"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!melodySteps.length && (
                  <div className="rounded-2xl bg-sage/8 border border-sage/15 p-4 text-center">
                    <p className="text-2xl mb-2">✦</p>
                    <p className="text-xs text-forest/50 leading-relaxed">
                      Every name sounds different.<br />
                      Try yours, your friend's, your city's.
                    </p>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>

      </div>
    </section>
  );
}