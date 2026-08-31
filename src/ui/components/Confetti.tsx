/** A small canvas celebration. No library — everything must inline (research R9). */
import { useEffect, useRef } from 'react';

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
}

const COLORS = ['#d4761a', '#2f6f4f', '#e0b24a', '#4a7fb5', '#b5504a', '#7a5aa8'];

export function Confetti({ fire, reduced }: { fire: number; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (fire === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);
    const count = reduced ? 40 : 140;

    const pieces: Piece[] = Array.from({ length: count }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height * 0.45 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 13 - 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 7 + Math.random() * 9,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
    }));

    let frame = 0;
    let raf = 0;
    const total = reduced ? 45 : 150;

    const tick = (): void => {
      frame += 1;
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vy += 0.36; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / total);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (frame < total) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width, height);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, reduced]);

  return <canvas ref={canvasRef} className="confetti" aria-hidden="true" />;
}
