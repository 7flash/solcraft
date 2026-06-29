'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultLevel,
  drawEditorScene,
  objectAtTile,
  screenToTile,
  TILE_PALETTE,
  OBJECT_PALETTE,
  type EditorCamera,
  type LevelData,
  type LevelObject,
  type LevelObjectKind,
  type LevelTileKind,
} from '../../client/world/levelEditorRenderer';

type Tool = 'tile' | 'object' | 'select' | 'erase' | 'player';

const STORAGE_KEY = 'solcraft:level-editor:v1';

function loadInitialLevel(): LevelData {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : '';
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.tiles) && Array.isArray(parsed.objects)) return parsed;
    }
  } catch {}
  return defaultLevel();
}

function numberOr(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLevel(input: any): LevelData {
  const tiles = Array.isArray(input?.tiles) ? input.tiles.map((t: any) => ({
    x: Math.round(numberOr(t.x, 0)),
    z: Math.round(numberOr(t.z, 0)),
    kind: String(t.kind || 'grass') as LevelTileKind,
    elev: numberOr(t.elev, 0),
  })) : [];
  const objects = Array.isArray(input?.objects) ? input.objects.map((o: any, i: number) => ({
    id: String(o.id || `obj_${Date.now()}_${i}`),
    kind: String(o.kind || 'block') as LevelObjectKind,
    x: numberOr(o.x, 0),
    z: numberOr(o.z, 0),
    w: Math.max(0.5, numberOr(o.w, 4)),
    d: Math.max(0.5, numberOr(o.d, 4)),
    h: numberOr(o.h, 3),
    color: String(o.color || '#8495a4'),
    roof: String(o.roof || '#dbc46b'),
  })) : [];
  return { version: 1, tiles, objects };
}

function replaceTile(level: LevelData, x: number, z: number, kind: LevelTileKind) {
  const key = `${x},${z}`;
  const next = level.tiles.filter((t) => `${t.x},${t.z}` !== key);
  return { ...level, tiles: [...next, { x, z, kind, elev: 0 }] };
}

function removeTile(level: LevelData, x: number, z: number) {
  const key = `${x},${z}`;
  return { ...level, tiles: level.tiles.filter((t) => `${t.x},${t.z}` !== key) };
}

function objectDefaults(kind: LevelObjectKind): Partial<LevelObject> {
  return OBJECT_PALETTE.find((p) => p.kind === kind)?.defaults || {};
}

function makeObject(kind: LevelObjectKind, x: number, z: number): LevelObject {
  const d = objectDefaults(kind);
  return {
    id: `obj_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    kind,
    x,
    z,
    w: numberOr(d.w, 4),
    d: numberOr(d.d, 4),
    h: numberOr(d.h, 3),
    color: String(d.color || '#8495a4'),
    roof: String(d.roof || '#dbc46b'),
  };
}

function updateObject(level: LevelData, id: string, patch: Partial<LevelObject>) {
  return { ...level, objects: level.objects.map((o) => o.id === id ? { ...o, ...patch } : o) };
}

export default function LevelEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [level, setLevel] = useState<LevelData>(() => loadInitialLevel());
  const [tool, setTool] = useState<Tool>('tile');
  const [tileKind, setTileKind] = useState<LevelTileKind>('grass');
  const [objectKind, setObjectKind] = useState<LevelObjectKind>('block');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [player, setPlayer] = useState({ x: 0, z: 0 });
  const [camera, setCamera] = useState<EditorCamera>({ x: 0, z: 0, zoom: 1 });
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const selected = useMemo(() => level.objects.find((o) => o.id === selectedId) || null, [level.objects, selectedId]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(level)); } catch {}
  }, [level]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
      if (k === '1') setTool('tile');
      if (k === '2') setTool('object');
      if (k === '3') setTool('select');
      if (k === '4') setTool('erase');
      if (k === '5') setTool('player');
      if (k === 'delete' || k === 'backspace') {
        if (selectedId) {
          setLevel((l) => ({ ...l, objects: l.objects.filter((o) => o.id !== selectedId) }));
          setSelectedId(null);
        }
      }
      setKeys((prev) => ({ ...prev, [k]: true }));
    }
    function onKeyUp(e: KeyboardEvent) { setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false })); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [selectedId]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let dx = 0, dz = 0;
      if (keys.w || keys.arrowup) dz -= 1;
      if (keys.s || keys.arrowdown) dz += 1;
      if (keys.a || keys.arrowleft) dx -= 1;
      if (keys.d || keys.arrowright) dx += 1;
      if (dx || dz) {
        const len = Math.hypot(dx, dz) || 1;
        const speed = 8;
        if (keys.shift) setCamera((c) => ({ ...c, x: c.x + (dx / len) * speed * dt, z: c.z + (dz / len) * speed * dt }));
        else setPlayer((p) => ({ x: p.x + (dx / len) * speed * dt, z: p.z + (dz / len) * speed * dt }));
      }
      const cv = canvasRef.current;
      if (cv) {
        const rect = cv.getBoundingClientRect();
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        const ctx = cv.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawEditorScene(ctx, { level, camera, hover, selectedId, player }, rect.width, rect.height);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, camera, hover, selectedId, player, keys]);

  function canvasTile(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToTile(e.clientX - rect.left, e.clientY - rect.top, camera, rect.width, rect.height);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    setHover(canvasTile(e));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = canvasTile(e);
    setHover(p);
    if (tool === 'tile') setLevel((l) => replaceTile(l, p.x, p.z, tileKind));
    else if (tool === 'erase') {
      setLevel((l) => {
        const hit = objectAtTile(l, p.x, p.z);
        if (hit) return { ...l, objects: l.objects.filter((o) => o.id !== hit.id) };
        return removeTile(l, p.x, p.z);
      });
      setSelectedId(null);
    } else if (tool === 'object') {
      const obj = makeObject(objectKind, p.x, p.z);
      setLevel((l) => ({ ...l, objects: [...l.objects, obj] }));
      setSelectedId(obj.id);
      setTool('select');
    } else if (tool === 'select') {
      const hit = objectAtTile(level, p.x, p.z);
      if (hit) setSelectedId(hit.id);
      else setSelectedId(null);
    } else if (tool === 'player') setPlayer({ x: p.x, z: p.z });
  }

  function onPointerDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons !== 1) return;
    const p = canvasTile(e);
    setHover(p);
    if (tool === 'tile') setLevel((l) => replaceTile(l, p.x, p.z, tileKind));
    else if (tool === 'erase') setLevel((l) => removeTile(l, p.x, p.z));
  }

  function exportJson() {
    const text = JSON.stringify(level, null, 2);
    setJsonText(text);
    setJsonOpen(true);
  }

  function importJsonText() {
    try {
      const parsed = normalizeLevel(JSON.parse(jsonText));
      setLevel(parsed);
      setSelectedId(null);
      setJsonOpen(false);
    } catch (err: any) {
      alert(`Import failed: ${err?.message || err}`);
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solcraft-level.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(file: File | null | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setLevel(normalizeLevel(JSON.parse(String(reader.result || '{}'))));
        setSelectedId(null);
      } catch (err: any) { alert(`Import failed: ${err?.message || err}`); }
    };
    reader.readAsText(file);
  }

  const panelStyle: React.CSSProperties = { background: 'rgba(8,14,16,0.92)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 12 };
  const buttonStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.15)', background: '#152220', color: '#f1e7c7', borderRadius: 8, padding: '7px 9px', cursor: 'pointer' };
  const activeButton = { ...buttonStyle, background: '#204437', borderColor: '#14f195', color: '#effff8' };

  return (
    <div style={{ height: '100vh', background: '#071111', color: '#f1e7c7', display: 'grid', gridTemplateColumns: '310px 1fr 320px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <aside style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
        <div style={panelStyle}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>SolCraft Level Editor</h2>
          <p style={{ margin: 0, opacity: 0.78, fontSize: 13 }}>Paint diamond tiles, place prism units, test grounding, and export level JSON.</p>
        </div>
        <div style={panelStyle}>
          <b>Tools</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {(['tile','object','select','erase','player'] as Tool[]).map((t) => <button key={t} onClick={() => setTool(t)} style={tool === t ? activeButton : buttonStyle}>{t}</button>)}
          </div>
        </div>
        <div style={panelStyle}>
          <b>Tiles</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {TILE_PALETTE.map((t) => <button key={t.kind} onClick={() => { setTileKind(t.kind); setTool('tile'); }} style={tileKind === t.kind && tool === 'tile' ? activeButton : buttonStyle}><span style={{ display: 'inline-block', width: 12, height: 12, background: t.color, borderRadius: 3, marginRight: 6 }} />{t.label}</button>)}
          </div>
        </div>
        <div style={panelStyle}>
          <b>Objects / prisms</b>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {OBJECT_PALETTE.map((o) => <button key={o.kind} onClick={() => { setObjectKind(o.kind); setTool('object'); }} style={objectKind === o.kind && tool === 'object' ? activeButton : buttonStyle}>{o.label}</button>)}
          </div>
        </div>
      </aside>

      <main style={{ position: 'relative', padding: 12 }}>
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => { onPointerMove(e); onPointerDrag(e); }}
          onPointerDown={onPointerDown}
          style={{ width: '100%', height: '100%', display: 'block', borderRadius: 14, background: '#10211f', cursor: tool === 'select' ? 'default' : 'crosshair', boxShadow: '0 20px 80px rgba(0,0,0,0.42)' }}
        />
        <div style={{ position: 'absolute', left: 24, bottom: 24, background: 'rgba(0,0,0,0.52)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px', fontSize: 12 }}>
          Hover {hover ? `${hover.x}, ${hover.z}` : '—'} · Player {player.x.toFixed(1)}, {player.z.toFixed(1)} · Shift+WASD pans camera
        </div>
      </main>

      <aside style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
        <div style={panelStyle}>
          <b>Scene</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button style={buttonStyle} onClick={exportJson}>Export</button>
            <button style={buttonStyle} onClick={downloadJson}>Download</button>
            <button style={buttonStyle} onClick={() => { setJsonText(JSON.stringify(level, null, 2)); setJsonOpen(true); }}>Import text</button>
            <button style={buttonStyle} onClick={() => fileRef.current?.click()}>Import file</button>
            <button style={buttonStyle} onClick={() => { setLevel(defaultLevel()); setSelectedId(null); }}>Reset</button>
            <button style={buttonStyle} onClick={() => { setLevel({ version: 1, tiles: [], objects: [] }); setSelectedId(null); }}>Clear</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.currentTarget.files?.[0])} />
        </div>

        <div style={panelStyle}>
          <b>Camera</b>
          <label style={{ display: 'block', marginTop: 10, fontSize: 13 }}>Zoom {camera.zoom.toFixed(2)}</label>
          <input type="range" min="0.55" max="1.8" step="0.05" value={camera.zoom} onChange={(e) => setCamera((c) => ({ ...c, zoom: Number(e.currentTarget.value) }))} style={{ width: '100%' }} />
          <button style={{ ...buttonStyle, marginTop: 8 }} onClick={() => setCamera({ x: 0, z: 0, zoom: 1 })}>Reset camera</button>
        </div>

        <div style={panelStyle}>
          <b>Selected object</b>
          {!selected ? <p style={{ opacity: 0.7, fontSize: 13 }}>Select an object to edit dimensions, height, color, and roof.</p> : (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <label>Kind
                <select value={selected.kind} onChange={(e) => updateSelected({ kind: e.currentTarget.value as LevelObjectKind })} style={{ width: '100%' }}>
                  {OBJECT_PALETTE.map((o) => <option key={o.kind} value={o.kind}>{o.label}</option>)}
                </select>
              </label>
              {(['x','z','w','d','h'] as const).map((key) => <label key={key}>{key}
                <input type="number" step="0.25" value={selected[key]} onChange={(e) => updateSelected({ [key]: Number(e.currentTarget.value) } as any)} style={{ width: '100%' }} />
              </label>)}
              <label>Wall color <input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.currentTarget.value })} /></label>
              <label>Roof color <input type="color" value={selected.roof} onChange={(e) => updateSelected({ roof: e.currentTarget.value })} /></label>
              <button style={buttonStyle} onClick={() => { setLevel((l) => ({ ...l, objects: l.objects.filter((o) => o.id !== selected.id) })); setSelectedId(null); }}>Delete object</button>
            </div>
          )}
        </div>
      </aside>

      {jsonOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ width: 'min(900px, 92vw)', height: 'min(720px, 86vh)', background: '#0d1617', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 14, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 10 }}>
          <b>Level JSON</b>
          <textarea value={jsonText} onChange={(e) => setJsonText(e.currentTarget.value)} style={{ width: '100%', height: '100%', resize: 'none', background: '#071011', color: '#f1e7c7', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={buttonStyle} onClick={() => setJsonOpen(false)}>Close</button>
            <button style={activeButton} onClick={importJsonText}>Import JSON</button>
          </div>
        </div>
      </div>}
    </div>
  );

  function updateSelected(patch: Partial<LevelObject>) {
    if (!selectedId) return;
    setLevel((l) => updateObject(l, selectedId, patch));
  }
}
