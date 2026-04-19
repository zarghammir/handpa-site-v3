// src/components/HandpanScene.js
//
// ─── What this file teaches ──────────────────────────────────────────────────
//
// THREE.JS FUNDAMENTALS
//   Every 3D scene needs four things: a Renderer (draws to canvas), a Scene
//   (the container for all objects), a Camera (your viewpoint), and a render
//   loop (requestAnimationFrame that redraws every frame).
//
// SCENE GRAPH
//   Objects in Three.js form a tree. A Group is a parent node — transform the
//   group and all children move together. The handpan body + all tone fields
//   are children of one group, so we can rotate the whole instrument at once.
//
// GEOMETRY + MATERIAL + MESH
//   Geometry = the shape (vertex positions). Material = how light interacts
//   with the surface. Mesh = geometry + material combined into a drawable
//   object. This trio is the atomic unit of 3D rendering.
//
// PBR MATERIALS (MeshStandardMaterial)
//   PBR = Physically Based Rendering. Instead of fake colors, you describe
//   how the surface behaves with light: metalness (0=plastic, 1=metal) and
//   roughness (0=mirror, 1=completely matte). The renderer calculates the
//   realistic light bounce for you.
//
// RAYCASTING
//   How do you click on a 3D object? You fire an invisible ray from the
//   camera through the mouse position into the scene. Any mesh the ray hits
//   is an "intersection". This is the universal pattern for 3D interaction.
//
// CSS2DRenderer
//   Three.js has a second renderer that overlays HTML/CSS labels on top of
//   the WebGL canvas. It tracks the 3D position of an object each frame and
//   moves a DOM element to match. This is how the floating note names work.
//
// ORBIT CONTROLS
//   OrbitControls handles drag-to-rotate, pinch-to-zoom, and auto-rotate.
//   It attaches its own event listeners to the DOM element you give it.
//   We disable zoom (not useful for an instrument) and cap the vertical
//   orbit angle so you can't flip the handpan upside down.
//
// RENDER LOOP
//   requestAnimationFrame(animate) schedules animate() to run before the next
//   screen repaint (~60fps). Each call renders one frame and schedules the
//   next. To stop, cancel the animation frame ID. Always clean up on unmount
//   or you get a memory leak (the loop keeps running in the background).
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ─── Note data ────────────────────────────────────────────────────────────────
// Mirrors the data in HandpanExplorer.jsx — single source of truth would be
// better (shared constants file), but we duplicate here for clarity.

const DING = {
  id: "ding", freq: 146.83, label: "Ding",
  displayName: "D — The Root",
  mood: "Grounding. This is home base.",
  role: "Root note",
};

const TONE_FIELDS = [
  { id: "tf1", freq: 220.0,  label: "A",  displayName: "A — The Fifth",              role: "5th — harmony"      },
  { id: "tf2", freq: 233.08, label: "Bb", displayName: "Bb — The Minor Second",      role: "2nd — texture"      },
  { id: "tf3", freq: 261.63, label: "C",  displayName: "C — The Minor Third",        role: "3rd — defines mood" },
  { id: "tf4", freq: 293.66, label: "D",  displayName: "D — The Octave",             role: "Octave — brightness" },
  { id: "tf5", freq: 329.63, label: "E",  displayName: "E — The Second",             role: "2nd — movement"     },
  { id: "tf6", freq: 349.23, label: "F",  displayName: "F — Minor Third (high)",     role: "3rd — depth"        },
  { id: "tf7", freq: 392.0,  label: "G",  displayName: "G — The Fourth",             role: "4th — flow"         },
  { id: "tf8", freq: 440.0,  label: "A",  displayName: "A — The High Fifth",         role: "5th (high) — peak"  },
];

// Colors for active notes — matching the site palette
const ACTIVE_COLOR  = new THREE.Color("#E67E22"); // orange flash on tap
const DEFAULT_COLOR = new THREE.Color("#8B9E7B"); // sage-ish metal
const DING_COLOR    = new THREE.Color("#A0B090"); // slightly brighter center

// ─── Main export ─────────────────────────────────────────────────────────────
// Returns { mount, unmount, highlightNote, clearNote }
// React wraps this; it knows nothing about React itself.

export function createHandpanScene(container, onNoteClick) {
  let animFrameId = null;
  let autoRotateTimeout = null;
  const ripples = []; // active ripple animations
  const noteMeshMap = {}; // noteId → { mesh, labelObj, originalColor }

  // ── Renderer ────────────────────────────────────────────────────────────────
  // WebGLRenderer draws the 3D scene to a <canvas>.
  // antialias=true smooths jagged edges (costs some GPU but worth it at this
  // scene complexity). alpha=true = transparent background so the cream section
  // background shows through.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2x for perf
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // ── Scene ────────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();

  // ── Camera ───────────────────────────────────────────────────────────────────
  // PerspectiveCamera(fov, aspect, near, far)
  // fov=45 feels natural. We update aspect on resize.
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 3.5, 3.5);
  camera.lookAt(0, 0.3, 0);

  // ── Lights ───────────────────────────────────────────────────────────────────
  // AmbientLight = soft fill light from all directions (no shadows)
  // DirectionalLight = sun-like, casts shadows, gives the metallic sheen
  // PointLight = local warm light to add depth

  // Brighter ambient so the instrument reads well on the cream background
  const ambient = new THREE.AmbientLight(0xfff8f0, 1.4);
  scene.add(ambient);

  // Strong key light from top-right — gives the metallic sheen
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(3, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  scene.add(keyLight);

  // Cool fill from the left to separate the dome from the background
  const fillLight = new THREE.DirectionalLight(0xd0e8ff, 1.2);
  fillLight.position.set(-5, 3, -2);
  scene.add(fillLight);

  // Warm under-light to lift the bottom edge
  const rimLight = new THREE.PointLight(0xffe8cc, 1.5, 12);
  rimLight.position.set(0, -2, 3);
  scene.add(rimLight);

  // ── Handpan group ─────────────────────────────────────────────────────────
  // All handpan parts live inside this group.
  // Rotating the group = rotating the whole instrument.
  const handpanGroup = new THREE.Group();
  scene.add(handpanGroup);

  // ── Geometry constants (shared with tone field placement) ─────────────────
  const DOME_R = 1.5;   // radius of the instrument
  const DOME_H = 0.72;  // height of the top dome
  const BOT_H  = 0.45;  // depth of the bottom bowl
  const SEG    = 40;    // profile resolution

  // ── Top dome ──────────────────────────────────────────────────────────────
  // LatheGeometry spins a 2D sine-curve profile around Y.
  // Points: rim (r=DOME_R, y=0) → center top (r=0, y=DOME_H).
  const topPoints = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    topPoints.push(new THREE.Vector2(DOME_R * (1 - t), DOME_H * Math.sin(t * Math.PI / 2)));
  }

  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#8aa080"),
    metalness: 0.85,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });

  const topShell = new THREE.Mesh(new THREE.LatheGeometry(topPoints, 80), shellMat);
  topShell.castShadow = true;
  topShell.receiveShadow = true;
  handpanGroup.add(topShell);

  // ── Bottom bowl ───────────────────────────────────────────────────────────
  // A real handpan is a lentil shape — two bowls joined at the rim.
  // Same profile as the top but curves DOWNWARD (negative y).
  const botPoints = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    botPoints.push(new THREE.Vector2(DOME_R * (1 - t), -BOT_H * Math.sin(t * Math.PI / 2)));
  }
  const botShell = new THREE.Mesh(new THREE.LatheGeometry(botPoints, 80), shellMat);
  botShell.castShadow = true;
  handpanGroup.add(botShell);

  // ── Rim ring ──────────────────────────────────────────────────────────────
  const rimMesh = new THREE.Mesh(
    new THREE.TorusGeometry(DOME_R, 0.06, 20, 100),
    shellMat
  );
  rimMesh.rotation.x = Math.PI / 2;
  handpanGroup.add(rimMesh);

  // Slight forward tilt so the viewer sees the top face naturally
  handpanGroup.rotation.x = 0.1;

  // ── Tone field material factory ──────────────────────────────────────────
  // Each field gets its own material instance so we can change its color
  // independently when it's played. Sharing a material would change all fields.
  function makeFieldMat(color) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.88,
      roughness: 0.18,
      envMapIntensity: 1.2,
    });
  }

  // ── Ding (center bump) ────────────────────────────────────────────────────
  // Sits at the exact top of the dome: y = DOME_H (t=1 in the profile).
  // We use a shallow sphere cap (thetaLength = PI*0.4) so it's a gentle bump.
  const dingGeo = new THREE.SphereGeometry(0.26, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.4);
  const dingMat = makeFieldMat(DING_COLOR);
  const dingMesh = new THREE.Mesh(dingGeo, dingMat);
  dingMesh.position.y = DOME_H + 0.01; // dome top + tiny lift
  dingMesh.userData = { noteId: "ding", note: DING };
  dingMesh.castShadow = true;

  handpanGroup.add(dingMesh);
  noteMeshMap["ding"] = { mesh: dingMesh, mat: dingMat, baseColor: DING_COLOR.clone() };

  // ── Tone fields (×8 ring) ─────────────────────────────────────────────────
  // Key insight: the dome surface height at horizontal radius r is:
  //   t = 1 - r/DOME_R   (t=0 at rim, t=1 at center)
  //   y = DOME_H * sin(t * PI/2)
  // The field must be positioned AT this y, then tilted to match the surface normal.
  // The surface normal direction at radius r is the tangent of the profile rotated 90°.
  // We approximate it by pointing from (0, 0, 0) outward along (x, slopeY, z).
  const RING_R = 0.82; // horizontal ring radius — kept inside the dome face

  TONE_FIELDS.forEach((note, i) => {
    const angle = ((i / TONE_FIELDS.length) * Math.PI * 2) - Math.PI / 2;

    const x = RING_R * Math.cos(angle);
    const z = RING_R * Math.sin(angle);

    // Exact surface height using the same formula as the LatheGeometry profile
    const t = 1 - RING_R / DOME_R;
    const surfaceY = DOME_H * Math.sin(t * Math.PI / 2);

    // Lift the field 0.02 above the surface so it's clearly visible
    const fieldY = surfaceY + 0.02;

    const fieldGeo = new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const fieldMat = makeFieldMat(DEFAULT_COLOR);
    const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
    fieldMesh.position.set(x, fieldY, z);

    // Tilt to match dome surface normal.
    // At this point on the dome the outward normal points roughly in the direction
    // of (x, slopeY_component, z). We compute the slope from the profile tangent:
    //   dy/dr = -DOME_H * cos(t*PI/2) * (PI/2) / DOME_R  (negative = slopes down)
    // Normal = perpendicular to tangent, pointing outward-upward.
    const dydR = -(DOME_H * Math.cos(t * Math.PI / 2) * (Math.PI / 2)) / DOME_R;
    // The outward normal in the XZ plane tilted by the slope angle:
    const nx = x / RING_R;   // unit vector in XZ
    const nz = z / RING_R;
    const normalVec = new THREE.Vector3(nx * Math.abs(dydR), 1, nz * Math.abs(dydR)).normalize();
    fieldMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalVec);

    fieldMesh.userData = { noteId: note.id, note };
    fieldMesh.castShadow = true;

    // Inner decorative ring
    const ringMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#4a6040"), metalness: 0.95, roughness: 0.1 });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.01, 8, 32), ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    fieldMesh.add(ringMesh);

    handpanGroup.add(fieldMesh);
    noteMeshMap[note.id] = { mesh: fieldMesh, mat: fieldMat, baseColor: DEFAULT_COLOR.clone() };
  });

  // ── Hint pulses ───────────────────────────────────────────────────────────
  // Three pulsing orange rings float above the ding + two opposite tone fields,
  // drawing the user's eye and signalling "tap me". They animate in the render
  // loop (scale + opacity oscillate on a sine wave). Calling dismissHints()
  // removes them all instantly — triggered on first tap.
  let hintsActive = true;
  const hintMeshes = []; // { mesh, mat, offset } — offset staggers the phase

  // Pick ding + tf1 + tf5 (spread across the ring so the hint looks balanced)
  const hintNoteIds = ["ding", "tf1", "tf5"];

  hintNoteIds.forEach((id, i) => {
    const entry = noteMeshMap[id];
    if (!entry) return;

    const geo = new THREE.RingGeometry(0.28, 0.34, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: ACTIVE_COLOR,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Position the ring just above the field in its local space
    // so it moves with the instrument as it rotates
    mesh.position.set(0, 0.18, 0);
    // Face up (lie flat on the dome surface)
    mesh.rotation.x = -Math.PI / 2;

    entry.mesh.add(mesh); // child of the field mesh — inherits its tilt
    hintMeshes.push({ mesh, mat, offset: i * (Math.PI * 0.66) }); // stagger phase
  });

  function dismissHints() {
    if (!hintsActive) return;
    hintsActive = false;
    hintMeshes.forEach(({ mesh, mat }) => {
      mat.opacity = 0;
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    });
    hintMeshes.length = 0;
  }

  // ── Raycaster ─────────────────────────────────────────────────────────────
  // The raycaster converts 2D mouse coordinates into a 3D ray and finds which
  // meshes it intersects. This is the standard pattern for all 3D interaction.
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  // Collect all clickable meshes
  const clickableMeshes = Object.values(noteMeshMap).map((n) => n.mesh);

  function getCanvasPos(event, el) {
    const rect = el.getBoundingClientRect();
    // Support both mouse and touch events
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  function castRay(pos) {
    mouse.set(pos.x, pos.y);
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(clickableMeshes, false);
  }

  // ── Ripple effect ──────────────────────────────────────────────────────────
  // When a note is played, we spawn a RingGeometry at the field's world position
  // and animate it expanding outward and fading. Pure Three.js animation —
  // no external library needed.
  function spawnRipple(worldPos) {
    const geo = new THREE.RingGeometry(0.01, 0.06, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: ACTIVE_COLOR,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(worldPos);
    ring.position.y += 0.05; // slightly above surface
    // Orient the ring to face the camera (billboard)
    ring.lookAt(camera.position);
    scene.add(ring);

    ripples.push({ mesh: ring, mat, age: 0, duration: 0.7 });
  }

  // ── Orbit controls ────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;       // no zoom — keeps it simple on mobile
  controls.enablePan = false;        // no panning
  controls.minPolarAngle = Math.PI * 0.15; // can't go below the instrument
  controls.maxPolarAngle = Math.PI * 0.55; // can't flip upside down
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  controls.rotateSpeed = 0.8;       // slightly slower for precision on mobile
  controls.dampingFactor = 0.08;
  controls.enableDamping = true;

  // Auto-rotate resumes 3s after user stops interacting
  function pauseAutoRotate() {
    controls.autoRotate = false;
    clearTimeout(autoRotateTimeout);
    autoRotateTimeout = setTimeout(() => {
      controls.autoRotate = true;
    }, 3000);
  }

  controls.addEventListener("start", pauseAutoRotate);

  // ── Event: click / tap ────────────────────────────────────────────────────
  function handlePointerDown(e) {
    // Ignore multi-touch (pinch) — let OrbitControls handle it
    if (e.touches && e.touches.length > 1) return;

    const pos = getCanvasPos(e, renderer.domElement);
    const hits = castRay(pos);
    if (!hits.length) return;

    const hit = hits[0];
    const { noteId, note } = hit.object.userData;
    if (!noteId) return;

    // Flash the field orange
    highlightNote(noteId);

    // Dismiss hint rings on first tap
    dismissHints();

    // Spawn ripple at the hit point in world space
    spawnRipple(hit.point);

    // Tell React about the click
    onNoteClick && onNoteClick(note);
  }

  // ── Event: hover (desktop only) — cursor feedback only ───────────────────
  function handleMouseMove(e) {
    const pos = getCanvasPos(e, renderer.domElement);
    const hits = castRay(pos);
    renderer.domElement.style.cursor = hits.length && hits[0].object.userData.noteId
      ? "pointer"
      : "default";
  }

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("touchstart", handlePointerDown, { passive: true });
  renderer.domElement.addEventListener("mousemove", handleMouseMove);

  // ── Resize handler ────────────────────────────────────────────────────────
  function handleResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  // ── Render loop ────────────────────────────────────────────────────────────
  // This is the heartbeat of every 3D app. It runs ~60 times per second.
  // Each call: update controls → update ripples → render scene → schedule next.
  const clock = new THREE.Clock();

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // OrbitControls damping needs to be updated each frame
    controls.update();

    // Animate hint pulses — sine wave on opacity + scale
    if (hintsActive && hintMeshes.length) {
      const t = clock.elapsedTime;
      hintMeshes.forEach(({ mesh, mat, offset }) => {
        // Pulse period ~1.8s, staggered by offset
        const s = Math.sin(t * 3.5 + offset);        // -1 → 1
        const pulse = (s + 1) / 2;                    // 0 → 1
        mat.opacity = 0.15 + pulse * 0.55;            // 0.15 → 0.70
        const scale = 1 + pulse * 0.45;               // 1.0 → 1.45
        mesh.scale.setScalar(scale);
      });
    }

    // Animate ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += delta;
      const t = r.age / r.duration; // 0→1 over lifetime
      r.mesh.scale.setScalar(1 + t * 8);
      r.mat.opacity = 0.8 * (1 - t);
      if (r.age >= r.duration) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        ripples.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }

  animate();

  // ── Public API ─────────────────────────────────────────────────────────────
  // React calls these to drive the 3D state from outside.

  function highlightNote(noteId, active = true) {
    Object.values(noteMeshMap).forEach((entry) => {
      if (entry.isActive) {
        entry.mat.color.copy(entry.baseColor);
        entry.isActive = false;
      }
    });

    if (!active || !noteId) return;

    const entry = noteMeshMap[noteId];
    if (!entry) return;
    entry.mat.color.copy(ACTIVE_COLOR);
    entry.isActive = true;

    setTimeout(() => {
      if (entry.isActive) {
        entry.mat.color.copy(entry.baseColor);
        entry.isActive = false;
      }
    }, 500);
  }

  function clearAllHighlights() {
    Object.values(noteMeshMap).forEach((entry) => {
      entry.mat.color.copy(entry.baseColor);
      entry.isActive = false;
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  // Called by React in useEffect cleanup. Stops the loop, removes DOM nodes,
  // frees GPU memory. Missing this = memory leak.
  function unmount() {
    cancelAnimationFrame(animFrameId);
    clearTimeout(autoRotateTimeout);
    dismissHints(); // clean up hint meshes if user never tapped
    resizeObserver.disconnect();
    controls.dispose();
    renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
    renderer.domElement.removeEventListener("touchstart", handlePointerDown);
    renderer.domElement.removeEventListener("mousemove", handleMouseMove);
    renderer.dispose();

    // Remove the two canvas elements we added
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }

    // Dispose GPU geometry/materials
    Object.values(noteMeshMap).forEach(({ mesh, mat }) => {
      mesh.geometry?.dispose();
      mat.dispose();
    });
  }

  return { highlightNote, clearAllHighlights, dismissHints, unmount };
}

// ── Helper: create floating CSS label ───────────────────────────────────────