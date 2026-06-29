'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { drawRenderLabScene, type RenderLabBuilding, type RenderLabState } from '../../client/world/canvasPrismWorld';

const BUILDINGS: RenderLabBuilding[] = [
  { kind: 'house', x: -20, z: -8, w: 4, d: 4, h: 3.2 },
  { kind: 'workshop', x: -12, z: -8, w: 4, d: 4, h: 3.5 },
  { kind: 'vault', x: -4, z: -8, w: 4, d: 4, h: 4.0 },
  { kind: 'academy', x: 4, z: -8, w: 4, d: 4, h: 4.6 },
  { kind: 'townhall', x: 12, z: -8, w: 5, d: 5, h: 6.8 },
  { kind: 'citytower', x: 22, z: -8, w: 5, d: 5, h: 9.6 },
  { kind: 'keep', x: -16, z: 4, w: 5, d: 5, h: 7.2 },
  { kind: 'goldmine', x: -6, z: 4, w: 4, d: 4, h: 2.8 },
  { kind: 'quarry', x: 4, z: 4, w: 5, d: 5, h: -2.8 },
  { kind: 'worldwonder', x: 16, z: 6, w: 7, d: 7, h: 12.5 },
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function RenderLabPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [player, setPlayer] = useState({ x: 0, z: 12 });
  const [keys, setKeys] = useState<Record<string, boolean>>({});

  const state = useMemo<RenderLabState>(() => ({
    hover,
    player,
    buildings: BUILDINGS,
  }), [hover, player]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: true }));
    }
    function onKeyUp(e: KeyboardEvent) {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }));
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let dx = 0;
      let dz = 0;
      if (keys['w'] || keys['arrowup']) dz -= 1;
      if (keys['s'] || keys['arrowdown']) dz += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;
      if (dx || dz) {
        const len = Math.hypot(dx, dz) || 1;
        const speed = 8;
        setPlayer((p) => ({
          x: clamp(p.x + (dx / len) * speed * dt, -30, 30),
          z: clamp(p.z + (dz / len) * speed * dt, -18, 24),
        }));
      }
      const cv = canvasRef.current;
      if (cv) {
        const rect = cv.getBoundingClientRect();
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);
        if (cv.width !== w || cv.height !== h) {
          cv.width = w;
          cv.height = h;
        }
        const ctx = cv.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawRenderLabScene(ctx, state, rect.width, rect.height);
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [keys, state]);

  function onPointerMove(e: any) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const ox = rect.width * 0.5;
    const oy = rect.height * 0.62;
    const tileW = 44;
    const tileH = 22;
    const dx = (px - ox) / tileW;
    const dy = (py - oy) / tileH;
    const gx = Math.round(dx + dy);
    const gz = Math.round(dy - dx);
    setHover({ x: gx, z: gz });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0e1616', color: '#f1e7c7', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 24, alignItems: 'center', fontFamily: 'ui-sans-serif, system-ui' }}>
        <div><b>Render Lab</b> — fixed map, no gameplay systems</div>
        <div>Move: WASD / arrows</div>
        <div>Goal: validate footprint, grounding, quarry pit, and unit composition</div>
      </div>
      <div style={{ padding: 16 }}>
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          style={{ width: '100%', height: 'calc(100vh - 88px)', display: 'block', borderRadius: 14, background: '#10211f', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
        />
      </div>
    </div>
  );
}
