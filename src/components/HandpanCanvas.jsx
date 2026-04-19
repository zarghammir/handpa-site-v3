// src/components/HandpanCanvas.jsx
//
// ─── What this file teaches ──────────────────────────────────────────────────
//
// THE IMPERATIVE / DECLARATIVE BRIDGE
//   React is declarative — you describe what the UI should look like and React
//   handles the DOM. Three.js is imperative — you call functions to build and
//   mutate the 3D scene directly.
//
//   This component is the bridge. Its only job:
//     1. Give Three.js a DOM node to attach to (via useRef)
//     2. Run the Three.js setup once on mount (useEffect with [] deps)
//     3. Clean up when the component unmounts (useEffect cleanup function)
//
//   This is the standard pattern for integrating ANY imperative library into
//   React: Mapbox, Chart.js, D3, video players, canvas games — same structure.
//
// useRef vs useState for the scene
//   sceneRef holds the { highlightNote, unmount } object returned by
//   createHandpanScene. We use useRef (not useState) because:
//   - We don't want a re-render when it changes
//   - We need to access it inside the cleanup function (closure issue with state)
//
// useEffect dependency array
//   useEffect(() => { ... }, []) runs once after mount.
//   The cleanup function (return () => { ... }) runs before unmount.
//   This gives us the exact lifecycle we need: setup once, tear down once.
//
// Props:
//   onNoteClick(note) — called by the 3D scene when user taps a field
//   highlightNoteId   — React drives which note is highlighted (for patterns)
//   className         — pass Tailwind classes for sizing
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect } from "react";
import { createHandpanScene } from "../lib/HandpanScene";

export default function HandpanCanvas({ onNoteClick, highlightNoteId, className = "" }) {
  const containerRef = useRef(null);
  const sceneRef     = useRef(null);

  // ── Mount the Three.js scene once ─────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // createHandpanScene attaches its own <canvas> and <div> to `container`
    const scene = createHandpanScene(container, onNoteClick);
    sceneRef.current = scene;

    // Cleanup: called when this component unmounts.
    // Stops the render loop, removes DOM nodes, frees GPU memory.
    return () => {
      scene.unmount();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty array = run once on mount only

  // ── Sync highlighted note from React → Three.js ──────────────────────────
  // When HandpanExplorer plays a pattern or melody, it updates highlightNoteId.
  // We forward that into the scene's highlightNote() method.
  useEffect(() => {
    if (!sceneRef.current) return;
    if (highlightNoteId) {
      sceneRef.current.highlightNote(highlightNoteId);
    } else {
      sceneRef.current.clearAllHighlights();
    }
  }, [highlightNoteId]);

  // ── Render ─────────────────────────────────────────────────────────────────
  // Just a div. Three.js appends its <canvas> inside it.
  // The parent controls sizing via className.
  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
      aria-label="Interactive 3D handpan — tap any tone field to play"
      role="img"
    />
  );
}