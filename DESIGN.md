---
name: Medya Handpan
description: Warm, calm, human — cream ground, forest ink, sage growth, one orange action.
colors:
  forest: "#2D3B1F"
  sage: "#A6B28B"
  orange: "#E67E22"
  sand: "#EBD5AB"
  cream: "#FAFAF5"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 2.375rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 1.875rem)"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  pill: "9999px"
  bubble: "18px"
  card: "22px"
  panel: "26px"
  bar: "16px"
  input: "24px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.bar}"
    padding: "16px 20px"
  chip-countdown:
    backgroundColor: "rgba(250,250,245,0.15)"
    textColor: "{colors.sand}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  button-ghost-on-forest:
    backgroundColor: "transparent"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  card-journey:
    backgroundColor: "rgba(235,213,171,0.3)"
    textColor: "{colors.forest}"
    rounded: "{rounded.card}"
    padding: "20px"
  bubble-mine:
    backgroundColor: "#F0EAD8"
    textColor: "{colors.forest}"
    rounded: "18px 4px 18px 18px"
    padding: "10px 14px"
  bubble-theirs:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.forest}"
    rounded: "4px 18px 18px 18px"
    padding: "10px 14px"
  input-chat:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.forest}"
    rounded: "{rounded.input}"
    padding: "10px 16px"
  button-send:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    size: "42px"
  button-send-hover:
    backgroundColor: "{colors.sage}"
---

# Design System: Medya Handpan

## Overview

**Creative North Star: "A Lesson with a Friend"**

Medya Handpan is a one-teacher music site that reads like the instrument sounds: warm, resonant, unhurried. The ground is near-white cream, the ink is a deep forest green, and everything structural (borders, timelines, growth markers) is sage. The deepest committed surface — the student dashboard — treats a student's lessons as a conversation with their teacher, not a table of bookings: a dark forest hero panel greets you with your next lesson, a sage spine carries the journey downward, and notes render as chat bubbles between two people. It explicitly refuses the flat white admin-card idiom.

Density is low and mobile-first: one centered column, generous card padding, one thing per viewport band. Color discipline is the system's spine — orange exists for exactly one job per screen (the booking action and its live-status echoes), so the page always has a single obvious next step. Depth is soft and tinted, never gray; motion is a gentle rise-and-settle that respects reduced-motion.

**Key Characteristics:**
- Cream ground, forest ink, sage structure, orange reserved for the single primary action
- Large soft radii (18–26px) — nothing sharp, nothing fully square
- Weight-driven type hierarchy on a system sans (800–900 for headings, no display webfont)
- Shadows tinted with forest or orange, never neutral gray
- Hand-drawn single-stroke inline SVG icons (round caps, stroke 2–2.5)
- Index-staggered entrance motion with a full `prefers-reduced-motion` opt-out

## Colors

A five-token warm natural palette — wood, steel, and firelight — where role discipline matters more than hue count.

### Primary
- **Forest** (#2D3B1F): The ink and the depth. Headlines, body text, and the hero panel's ground (as a `linear-gradient(160deg, #3A4C28, #2D3B1F 60%)`). Also the base of every shadow tint and the fill of the circular send button. Muted small text is forest at reduced opacity — see the Contrast Floor rule.

### Secondary
- **Sage** (#A6B28B): Growth and structure. The journey timeline spine (gradient fading to `sage/25`), past-lesson spine dots, focused input borders, hover fill of the send button, and the border tint of the student's own chat bubble (`sage/40`).
- **Burnt Orange** (#E67E22): The one voice. Fill of the single booking CTA, the glowing live-countdown dot, latest/upcoming spine-dot rings, the text caret in chat inputs, and small hover accents (attach icon, edit link). Never a second filled button on the same screen.

### Neutral
- **Sand** (#EBD5AB): Warm secondary surface — empty-state card fill (`sand/30`), loading skeletons (`sand/60`), avatar-fallback circles, file-icon tiles, and the countdown chip's text color on forest.
- **Cream** (#FAFAF5): The page ground everywhere, and the text/border color on forest surfaces (at 10–85% opacities for etching, chips, and secondary copy).
- **Terracotta error family** (#FBF0E9 surface, #E5BFAE border, #8A3B24 text): failure states stay inside the warm world — a clay-toned card, not a stock red alert.

### Named Rules
**The One Orange Rule.** Orange is the booking action and its live echoes (countdown dot, upcoming markers, caret). One filled orange element per screen; everything else asking for attention must use weight, size, or sage.

**The Contrast Floor Rule.** Muted text is forest at reduced opacity, and on light grounds (cream, white, sand tints) small text never drops below `forest/70` (rgba(45,59,31,0.7)). `forest/60` is permitted only at 14px+; decorative etching on the dark panel may go fainter.

**The Warm Failure Rule.** Errors render in the terracotta family (#FBF0E9 / #E5BFAE / #8A3B24), inside the same 22px-radius card language as everything else.

## Typography

**Display Font:** System sans (ui-sans-serif, system-ui — Tailwind 4 default stack)
**Body Font:** Same stack; hierarchy is carried entirely by weight, size, and tracking.

**Character:** No webfont, no serif — the voice is plain and personal, and personality comes from very heavy weights (extrabold/black) at tight tracking against quiet, small, semibold metadata.

### Hierarchy
- **Display** (800, 32–38px, 1.1, tracking-tight, `text-wrap: balance`): the hero's lesson date — the biggest thing on the page.
- **Headline** (900, 24–30px, tracking-tight): the page title ("Your Lessons").
- **Section** (800, 20px, tracking-tight): section headings ("Your journey"), each paired with a `forest/60` one-line subtitle.
- **Title** (800, 16.5px, tracking-tight): journey-stop titles and CTA label.
- **Body** (400–600, 14–17px): note text, hero time line (`tabular-nums` for times), helper copy; long copy capped near 42ch.
- **Label** (600–700, 10–13.5px): timestamps, counts, chips. The only uppercase in the system is the tiny 11px bold wide-tracked "upcoming" status tag.

### Named Rules
**The Heavy Whisper Rule.** Headings are extrabold-to-black and tight; supporting text is small and semibold at `forest/70`. Nothing in between — no medium-weight 18px middle register.

**The Tabular Time Rule.** Times and countdowns set `tabular-nums`.

## Layout

Mobile-first single column: `max-w-2xl` centered, `px-4` gutters, `pt-6 sm:pt-10`, with `pb-36` bottom clearance for the sticky action bar. The only wider container is the cal.com embed (`max-w-5xl`). Vertical rhythm is Tailwind's 4px scale; sections separate by ~36px (`mt-9`), stops by 32px (`pb-8`).

The journey timeline indents content `30px` and draws a 2.5px sage gradient spine at `left: 9px`; dots hang at `-left-[27px]`. The primary action lives in a fixed bottom bar in the thumb zone — full-width to `max-w-2xl`, floated over a `cream → cream/90 → transparent` bottom gradient scrim, padded with `env(safe-area-inset-bottom)`.

Sub-views (book, profile) replace the journey in place with a small "Back to your lessons" link — no tab bar; the journey is the page.

## Elevation & Depth

Hybrid: tonal layering for surfaces (cream page, white/sand-tint cards, forest panel) plus soft, always-tinted shadows. No neutral gray or black shadow exists anywhere — every shadow carries forest ink `rgba(45,59,31,…)` or orange glow `rgba(230,126,34,…)`. Depth on the dark panel is etched inward: concentric inset rings at 3–3.5% cream opacity form the handpan tone-circle.

### Shadow Vocabulary
- **Card rest** (`0 3px 10px -4px rgba(45,59,31,0.12)` — bubbles use `0.14`): the default resting shadow for cards and chat bubbles.
- **Hero depth** (`0 18px 40px -18px rgba(45,59,31,0.55), 0 4px 12px -6px rgba(45,59,31,0.35)`): the forest panel only.
- **CTA glow** (`0 10px 26px -10px rgba(230,126,34,0.65), 0 3px 8px -4px rgba(45,59,31,0.3)`): the orange book bar; deepens on hover with a `-translate-y-0.5` lift.
- **Live dot glow** (`0 0 8px 1px rgba(230,126,34,0.8)`): the 7px countdown pulse dot.
- **Dot halo** (`0 0 0 5px rgba(230,126,34,0.12–0.15)`): ring around the latest lesson's spine dot.

### Named Rules
**The Tinted Shadow Rule.** Shadows are forest-tinted; only orange elements may add an orange glow. Never `rgba(0,0,0,…)`.

## Shapes

Everything is soft and rounded; radius scales with prominence: pills (9999px) for chips, buttons-as-circles (42px), and outline actions; 18px chat bubbles; 22px cards; 26px hero panel; 16px sticky bar; 24px chat input. Chat bubbles carry a **4px "spoken-from" corner** — the corner nearest the speaker's avatar collapses to 4px (`18px 4px 18px 18px` for mine/right, `4px 18px 18px 18px` for theirs/left). Borders are thin (1–1.5px) and low-contrast: `sand`, `forest/10–15`, or `cream/20–35` on dark. The recurring geometry motif is the circle: spine dots, avatars, send/attach buttons, and the etched tone-circle.

Icons are a drawn one-stroke family: inline SVG, `fill="none"`, `stroke="currentColor"`, strokeWidth 2–2.5, round linecaps, 15–18px render size. No icon packages, no icon fonts, no filled glyphs.

## Components

### Sticky Book Bar (signature primary button)
- **Character:** the one orange thing — a thumb-height booking bar fixed to the viewport bottom.
- **Shape:** softly rounded bar (16px), full column width, `px-5 py-4`.
- **Color:** orange fill, white extrabold 16.5px label, leading one-stroke calendar-plus icon.
- **Hover:** lifts `-translate-y-0.5` and deepens the orange glow; `transition-all`.

### Hero Panel (Next Lesson)
- **Character:** the forest greeting — dark, warm, dimensional.
- **Surface:** 26px radius; forest gradient with a sage radial wash top-right and a faint orange radial wash bottom-left; deep tinted shadow; an etched tone-circle (230px, cream at 3–10% via border + inset rings) breaking the top-right corner.
- **Content:** `cream/75` kicker-free intro line ("Your next lesson"), display date, `cream/85` time line, then a chip row.
- **Chips:** countdown chip (`cream/15` fill, `cream/20` border, sand bold text, glowing orange dot) and a ghost pill action (`cream/35` border, transparent, `hover:bg-cream/10`).

### Journey Stop (timeline card row)
- **Spine dot:** 13px cream circle, 3px border encoding state — orange + halo (latest), `orange/50` (upcoming), sage (past).
- **Header row:** full-width toggle button; extrabold title left, quiet `forest/70` meta right ("2 notes · 1 file" — never a false claim while counts load) with a rotating chevron; `aria-expanded` set.
- **Empty state:** sand-tint card (`sand/30` fill, sand border, 22px radius, card-rest shadow).
- **Motion:** each stop staggers in by index (`0.3s + 0.12s × i`, capped 0.9s).

### Chat Bubbles (SessionNotes)
- **Mine (right):** parchment `#F0EAD8` fill, `sage/40` border, `18px 4px 18px 18px`.
- **Theirs (left):** white fill, `forest/10` border, `4px 18px 18px 18px`.
- **Anatomy:** 28px avatar circle beside the bubble (sand fallback with a bold initial), tiny extrabold author line (muted green `#5F6F49` for the other party, `forest/70` for you), body text, 10px semibold timestamp with "· edited".
- **File bubble:** always instructor-side; inner cream attachment card (12px radius) with a sand icon tile, filename, size, "tap to open"; lifts 1px on hover.

### Inputs / Fields
- **Chat input:** pill-shaped (24px) white textarea, `forest/12` border at 1.5px, 14.5px text, **orange caret**; focus swaps the border to sage (no ring, no glow). Enter sends, Shift+Enter breaks.
- **Send button:** 42px forest circle with a one-stroke send icon; hovers to sage; disabled at 40% opacity; spinner replaces the icon while saving.
- **Attach button:** 42px white circle, `forest/15` border, icon warms to orange on hover.

### Navigation
- No tab bar on the journey surface. Sub-views open in place; return is a small bold `forest/60 → forest` back link with a rotated chevron. Header is a single row: black-weight page title + avatar menu.

### Loading
- Skeletons are shape-true tinted blocks (`sand/60` bar, `forest/10` panel) with `animate-pulse` — no spinners on page load; spinners only inside buttons mid-action.

## Do's and Don'ts

### Do:
- **Do** keep exactly one orange-filled element per screen, in the thumb zone when it's the primary action.
- **Do** tint every shadow with forest `rgba(45,59,31,…)` (orange glow allowed only under orange elements).
- **Do** hold muted small text at `forest/70` or darker on light grounds (the Contrast Floor).
- **Do** stagger entrance motion by index (0.12s steps from 0.3s, capped ≤1s) using the `cubic-bezier(0.16, 1, 0.3, 1)` settle, and zero all of it under `prefers-reduced-motion: reduce`.
- **Do** draw new icons in the one-stroke family: inline SVG, currentColor stroke 2–2.5, round caps, 15–18px.
- **Do** collapse the speaker-side bubble corner to 4px and keep instructor content left / student content right.
- **Do** state honest empties ("no notes yet", "Your instructor hasn't added anything yet") and claim nothing while counts are unknown.

### Don't:
- **Don't** use flat white admin-card lists for lesson data — the journey/conversation form is the committed refusal of that idiom (direction contract, seed 8ce413f2).
- **Don't** introduce gray or black shadows, gray borders, or cool neutrals; every neutral in this world is warm (cream, sand, forest opacities).
- **Don't** use stock red alert styling; failures use the terracotta family inside the normal card language.
- **Don't** add a second accent, a webfont, an icon package, or uppercase display text (uppercase is reserved for the single 11px status tag).
- **Don't** put a countdown, glow, or orange ring on anything that isn't live or next — orange state markers mean "happening/soonest", not decoration.
