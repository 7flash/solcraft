// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from 'tradjs/client';
import {
  defaultLevel,
  drawEditorScene,
  objectAtTile,
  screenToTile,
  TILE_PALETTE,
  OBJECT_PALETTE,
} from '../../client/world/levelEditorRenderer';

const ROOT_ID = 'solcraft-level-editor-root';
const STORAGE_KEY = 'solcraft:level-editor:v1';

function numberOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLevel(input) {
  const tiles = Array.isArray(input?.tiles) ? input.tiles.map((t) => ({
    x: Math.round(numberOr(t.x, 0)),
    z: Math.round(numberOr(t.z, 0)),
    kind: String(t.kind || 'grass'),
    elev: numberOr(t.elev, 0),
  })) : [];
  const objects = Array.isArray(input?.objects) ? input.objects.map((o, i) => ({
    id: String(o.id || `obj_${Date.now()}_${i}`),
    kind: String(o.kind || 'block'),
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

function loadInitialLevel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeLevel(JSON.parse(raw));
  } catch {}
  return defaultLevel();
}

function replaceTile(level, x, z, kind) {
  const key = `${x},${z}`;
  const next = level.tiles.filter((t) => `${t.x},${t.z}` !== key);
  return { ...level, tiles: [...next, { x, z, kind, elev: 0 }] };
}

function removeTile(level, x, z) {
  const key = `${x},${z}`;
  return { ...level, tiles: level.tiles.filter((t) => `${t.x},${t.z}` !== key) };
}

function objectDefaults(kind) {
  return OBJECT_PALETTE.find((p) => p.kind === kind)?.defaults || {};
}

function previewFootprintForState(state) {
  if (state.tool !== 'object') return null;
  const d = objectDefaults(state.objectKind);
  return { w: d.w || 1, d: d.d || 1 };
}

function makeObject(kind, x, z) {
  const d = objectDefaults(kind);
  return {
    id: `obj_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    kind,
    x, z,
    w: d.w || 4,
    d: d.d || 4,
    h: d.h == null ? 3 : d.h,
    color: d.color || '#8495a4',
    roof: d.roof || '#dbc46b',
  };
}

export default function mount() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const state = {
    level: loadInitialLevel(),
    camera: { x: 0, z: 0, zoom: 1 },
    hover: null,
    selectedId: null,
    player: { x: 0, z: 12 },
    tool: 'tile',
    tileKind: 'grass',
    objectKind: 'block',
    keys: {},
    msg: 'Paint tiles, place prism units, select and edit objects. Hover is a true isometric diamond.',
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.level)); } catch {}
  }

  function selectedObject() {
    return state.level.objects.find((o) => o.id === state.selectedId) || null;
  }

  function updateSelected(field, value) {
    state.level = {
      ...state.level,
      objects: state.level.objects.map((o) => o.id === state.selectedId ? { ...o, [field]: value } : o),
    };
    save(); paint(); drawSoon();
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(state.level, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solcraft-level.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function importJson() {
    const raw = window.prompt('Paste level JSON');
    if (!raw) return;
    try {
      state.level = normalizeLevel(JSON.parse(raw));
      state.selectedId = null;
      state.msg = 'Imported level JSON.';
      save(); paint(); drawSoon();
    } catch (e) {
      state.msg = 'Import failed: invalid JSON.';
      paint();
    }
  }

  function exportJson() {
    try { navigator.clipboard?.writeText(JSON.stringify(state.level, null, 2)); } catch {}
    state.msg = 'Level JSON copied to clipboard.';
    paint();
  }

  function resetLevel() {
    if (!confirm('Reset level editor scene?')) return;
    state.level = defaultLevel();
    state.selectedId = null;
    save(); paint(); drawSoon();
  }

  function canvasPoint(ev) {
    const cv = ev.currentTarget;
    const rect = cv.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top, w: rect.width, h: rect.height };
  }

  function applyTool(tile) {
    if (!tile) return;
    if (state.tool === 'tile') {
      state.level = replaceTile(state.level, tile.x, tile.z, state.tileKind);
    } else if (state.tool === 'erase') {
      const hit = objectAtTile(state.level, tile.x, tile.z);
      if (hit) state.level = { ...state.level, objects: state.level.objects.filter((o) => o.id !== hit.id) };
      else state.level = removeTile(state.level, tile.x, tile.z);
    } else if (state.tool === 'object') {
      const obj = makeObject(state.objectKind, tile.x, tile.z);
      state.level = { ...state.level, objects: [...state.level.objects, obj] };
      state.selectedId = obj.id;
    } else if (state.tool === 'select') {
      state.selectedId = objectAtTile(state.level, tile.x, tile.z)?.id || null;
    } else if (state.tool === 'player') {
      state.player = { x: tile.x, z: tile.z };
    }
    save(); paint(); drawSoon();
  }

  function onCanvasMove(ev) {
    const p = canvasPoint(ev);
    state.hover = screenToTile(p.x, p.y, state.camera, p.w, p.h);
    drawSoon();
  }

  function onCanvasDown(ev) {
    if (ev.button !== 0) return;
    const p = canvasPoint(ev);
    state.hover = screenToTile(p.x, p.y, state.camera, p.w, p.h);
    applyTool(state.hover);
  }

  function drawSoon() {
    requestAnimationFrame(draw);
  }

  function draw() {
    const cv = document.getElementById('level-editor-canvas');
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEditorScene(ctx, {
      level: state.level,
      camera: state.camera,
      hover: state.hover,
      selectedId: state.selectedId,
      player: state.player,
      showTileCoords: false,
      previewFootprint: previewFootprintForState(state),
    }, rect.width, rect.height);
  }

  function paint() {
    const sel = selectedObject();
    render(<div className="le-shell">
      <style>{css}</style>
      <aside className="le-panel">
        <h1>SolCraft Level Editor</h1>
        <p>{state.msg}</p>
        <section><h2>Tool</h2><div className="le-row">
          {['tile','object','select','erase','player'].map((t) => <button className={state.tool === t ? 'on' : ''} onClick={() => { state.tool = t; paint(); }}>{t}</button>)}
        </div></section>
        <section><h2>Tiles</h2><div className="le-grid">
          {TILE_PALETTE.map((p) => <button className={state.tileKind === p.kind ? 'on' : ''} onClick={() => { state.tileKind = p.kind; state.tool = 'tile'; paint(); }}><i style={`background:${p.color}`} />{p.label}</button>)}
        </div></section>
        <section><h2>Prisms</h2><div className="le-grid">
          {OBJECT_PALETTE.map((p) => <button className={state.objectKind === p.kind ? 'on' : ''} onClick={() => { state.objectKind = p.kind; state.tool = 'object'; paint(); }}><b>{p.label}</b></button>)}
        </div></section>
        <section><h2>Scene</h2><div className="le-row"><button onClick={exportJson}>Copy JSON</button><button onClick={downloadJson}>Download</button><button onClick={importJson}>Import</button><button onClick={resetLevel}>Reset</button></div></section>
        {sel ? <section><h2>Selected</h2>
          <label>Kind <select value={sel.kind} onInput={(e) => updateSelected('kind', e.currentTarget.value)}>{OBJECT_PALETTE.map((p) => <option value={p.kind}>{p.label}</option>)}</select></label>
          {['x','z','w','d','h'].map((k) => <label>{k}<input type="number" step="0.25" value={sel[k]} onInput={(e) => updateSelected(k, Number(e.currentTarget.value))} /></label>)}
          <label>Wall <input type="color" value={sel.color} onInput={(e) => updateSelected('color', e.currentTarget.value)} /></label>
          <label>Roof <input type="color" value={sel.roof} onInput={(e) => updateSelected('roof', e.currentTarget.value)} /></label>
        </section> : <section><h2>Selected</h2><p>Select an object to edit footprint, height, colors, or quarry depth.</p></section>}
      </aside>
      <main className="le-stage"><canvas id="level-editor-canvas" onPointerMove={onCanvasMove} onPointerDown={onCanvasDown} /></main>
    </div>, root);
    drawSoon();
  }

  function tick() {
    const k = state.keys;
    const step = 0.12;
    let dirty = false;
    if (k['shift'] && (k['w'] || k['arrowup'])) { state.camera.z -= step; dirty = true; }
    if (k['shift'] && (k['s'] || k['arrowdown'])) { state.camera.z += step; dirty = true; }
    if (k['shift'] && (k['a'] || k['arrowleft'])) { state.camera.x -= step; dirty = true; }
    if (k['shift'] && (k['d'] || k['arrowright'])) { state.camera.x += step; dirty = true; }
    if (!k['shift'] && (k['w'] || k['arrowup'])) { state.player.z -= step; dirty = true; }
    if (!k['shift'] && (k['s'] || k['arrowdown'])) { state.player.z += step; dirty = true; }
    if (!k['shift'] && (k['a'] || k['arrowleft'])) { state.player.x -= step; dirty = true; }
    if (!k['shift'] && (k['d'] || k['arrowright'])) { state.player.x += step; dirty = true; }
    if (dirty) draw();
    requestAnimationFrame(tick);
  }

  window.addEventListener('keydown', (e) => {
    state.keys[e.key.toLowerCase()] = true;
    if (e.key === '+' || e.key === '=') { state.camera.zoom = Math.min(2.5, state.camera.zoom + 0.1); drawSoon(); }
    if (e.key === '-' || e.key === '_') { state.camera.zoom = Math.max(0.5, state.camera.zoom - 0.1); drawSoon(); }
  });
  window.addEventListener('keyup', (e) => { state.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize', drawSoon);

  paint();
  requestAnimationFrame(tick);
}

const css = `
.le-shell{height:100vh;display:grid;grid-template-columns:340px 1fr;background:#101918;color:#f3e8c7;font:14px ui-sans-serif,system-ui;overflow:hidden}.le-panel{padding:14px;overflow:auto;background:#111723;border-right:1px solid rgba(255,255,255,.08)}h1{font-size:18px;margin:0 0 8px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#d6c385;margin:14px 0 8px}p{color:#bdb49e;line-height:1.35}.le-row,.le-grid{display:flex;flex-wrap:wrap;gap:6px}.le-grid button{min-width:88px}button,select,input{background:#1d2632;color:#f7eccc;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 9px}button.on{background:#335346;border-color:#8be0ba}button i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}label{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:center;margin:6px 0}.le-stage{padding:14px}canvas{width:100%;height:calc(100vh - 28px);display:block;border-radius:14px;background:#10221f;box-shadow:0 20px 60px rgba(0,0,0,.35)}
`;
