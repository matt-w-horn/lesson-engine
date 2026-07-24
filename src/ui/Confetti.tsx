// A small one-shot confetti burst on a throwaway canvas, anchored near the
// completion check. ~800ms, 26 particles in the app's own accent tones,
// then the canvas unmounts. The caller gates on first completion and on
// prefers-reduced-motion; this component just performs.
import { useEffect, useRef } from "preact/hooks";
import { resolveColor } from "./motion";

const TONES = ["--pass-bright", "--accent", "--warn", "--reward"];
const DURATION_MS = 800;
const PARTICLES = 26;
const SIZE = 240; // css px, square, centered on the anchor

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  color: string;
}

export function ConfettiBurst({
  anchor,
  onDone,
}: {
  anchor: () => HTMLElement | null;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = anchor();
    const canvas = canvasRef.current;
    if (!el || !canvas) {
      onDone();
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.style.left = `${cx - SIZE / 2}px`;
    canvas.style.top = `${cy - SIZE / 2}px`;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onDone();
      return;
    }
    ctx.scale(dpr, dpr);

    const colors = TONES.map(resolveColor);
    const parts: Particle[] = Array.from({ length: PARTICLES }, (_, i) => {
      // A fountain: mostly upward, fanned out, gravity brings them back.
      const theta = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 60 + Math.random() * 110;
      return {
        x: SIZE / 2,
        y: SIZE / 2,
        vx: Math.cos(theta) * speed,
        vy: Math.sin(theta) * speed,
        spin: (Math.random() - 0.5) * 14,
        angle: Math.random() * Math.PI,
        size: 3 + Math.random() * 3,
        color: colors[i % colors.length],
      };
    });

    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const life = (now - t0) / DURATION_MS;
      if (life >= 1) {
        onDone();
        return;
      }
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.globalAlpha = life < 0.6 ? 1 : 1 - (life - 0.6) / 0.4;
      for (const p of parts) {
        p.vy += 340 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Mount-only by design: one burst per mount, the parent unmounts us after.
  }, []);

  return <canvas class="confetti" ref={canvasRef} aria-hidden="true" />;
}
