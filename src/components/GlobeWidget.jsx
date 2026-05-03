import { useEffect, useRef, useState } from 'react';

export default function GlobeWidget({ size = 100 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2;
    const R = size * 0.42;

    const cities = [
      [49.28, -123.12],   // Vancouver
      [51.51,  -0.13],    // London
      [35.68, 139.69],    // Tokyo
      [48.85,   2.35],    // Paris
      [-33.87, 151.21],   // Sydney
      [40.71,  -74.01],   // New York
      [19.07,   72.88],   // Mumbai
    ];

    const arcs = [[0,1],[0,5],[1,2],[2,4],[3,6],[5,3],[0,4]];

    let rotation = 0;
    let frameCount = 0;
    const arcProgress = arcs.map(() => 0);
    const arcDelay   = arcs.map((_, i) => i * 38);

    function latLonTo3D(lat, lon, rot) {
      const phi   = (90 - lat) * Math.PI / 180;
      const theta = (lon + rot) * Math.PI / 180;
      return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
      };
    }

    function proj(p) {
      return { x: cx + p.x * R, y: cy - p.y * R };
    }

    function drawFrame() {
      ctx.clearRect(0, 0, size, size);
      ctx.save();

      // Globe base
      const grad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.05, cx, cy, R);
      grad.addColorStop(0,   '#2d5a27');
      grad.addColorStop(0.5, '#1a3d16');
      grad.addColorStop(1,   '#0d1f0b');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Clip everything to sphere
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Grid lines
      ctx.strokeStyle = 'rgba(120,180,90,0.14)';
      ctx.lineWidth = 0.5;
      for (let lat = -75; lat <= 75; lat += 30) {
        ctx.beginPath();
        let go = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const p = latLonTo3D(lat, lon, rotation);
          if (p.z < 0) { go = false; continue; }
          const pt = proj(p);
          if (!go) { ctx.moveTo(pt.x, pt.y); go = true; } else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      for (let lon = 0; lon < 360; lon += 30) {
        ctx.beginPath();
        let go = false;
        for (let lat = -90; lat <= 90; lat += 5) {
          const p = latLonTo3D(lat, lon, rotation);
          if (p.z < 0) { go = false; continue; }
          const pt = proj(p);
          if (!go) { ctx.moveTo(pt.x, pt.y); go = true; } else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Arcs (draw once, stay)
      arcs.forEach(([ai, bi], idx) => {
        const t = arcProgress[idx];
        if (t === 0) return;
        const latA = cities[ai][0], lonA = cities[ai][1];
        const latB = cities[bi][0], lonB = cities[bi][1];
        const steps  = 40;
        const drawTo = Math.floor(t * steps);
        if (drawTo < 2) return;

        ctx.beginPath();
        let go = false;
        for (let i = 0; i <= drawTo; i++) {
          const s    = i / steps;
          const lat  = latA + (latB - latA) * s;
          const lon  = lonA + (lonB - lonA) * s;
          const lift = Math.sin(s * Math.PI) * R * 0.09;
          const p    = latLonTo3D(lat, lon, rotation);
          if (p.z < 0) { go = false; continue; }
          const pt = proj(p);
          const nx = (pt.x - cx) / R, ny = (pt.y - cy) / R;
          const lx = pt.x - nx * lift, ly = pt.y - ny * lift;
          if (!go) { ctx.moveTo(lx, ly); go = true; } else ctx.lineTo(lx, ly);
        }
        ctx.strokeStyle = 'rgba(230,160,60,0.9)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Moving tip dot while arc is drawing
        if (drawTo > 0 && drawTo < steps) {
          const s    = drawTo / steps;
          const lat  = latA + (latB - latA) * s;
          const lon  = lonA + (lonB - lonA) * s;
          const lift = Math.sin(s * Math.PI) * R * 0.09;
          const p    = latLonTo3D(lat, lon, rotation);
          if (p.z >= 0) {
            const pt = proj(p);
            const nx = (pt.x - cx) / R, ny = (pt.y - cy) / R;
            ctx.beginPath();
            ctx.arc(pt.x - nx * lift, pt.y - ny * lift, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,210,100,0.95)';
            ctx.fill();
          }
        }
      });

      // City dots with pulse
      const pulse = (Date.now() % 2000) / 2000;
      for (const [lat, lon] of cities) {
        const p = latLonTo3D(lat, lon, rotation);
        if (p.z < 0) continue;
        const fade = Math.min(1, p.z * 3);
        const pt   = proj(p);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,140,50,${fade})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(230,140,50,${fade * (1 - pulse) * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();

      // Subtle outer glow (outside clip)
      const glow = ctx.createRadialGradient(cx, cy, R - 2, cx, cy, R + R * 0.18);
      glow.addColorStop(0, 'rgba(100,180,80,0.35)');
      glow.addColorStop(1, 'rgba(100,180,80,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R + R * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Advance state
      rotation += 0.12;
      frameCount++;
      arcProgress.forEach((_, i) => {
        if (frameCount < arcDelay[i]) return;
        if (arcProgress[i] < 1) arcProgress[i] = Math.min(1, arcProgress[i] + 0.022);
      });

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }}
    />
  );
}
