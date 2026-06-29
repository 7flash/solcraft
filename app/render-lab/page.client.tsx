// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from 'tradjs/client';
import { defaultLevel, drawEditorScene, screenToTile } from '../../client/world/levelEditorRenderer';

const ROOT_ID = 'solcraft-render-lab-root';

function labLevel() {
  const level = defaultLevel();
  level.objects = [
    { id: 'house', kind: 'house', x: -20, z: -8, w: 4, d: 4, h: 2.8, color: '#b58b4e', roof: '#ead464' },
    { id: 'workshop', kind: 'roof', x: -12, z: -8, w: 5, d: 4, h: 3.4, color: '#8a7962', roof: '#f6e35a' },
    { id: 'vault', kind: 'block', x: -4, z: -8, w: 4, d: 4, h: 4.2, color: '#808984', roof: '#d8cd82' },
    { id: 'academy', kind: 'tower', x: 5, z: -8, w: 3.8, d: 3.8, h: 7.2, color: '#7d75a8', roof: '#d8c4ff' },
    { id: 'townhall', kind: 'roof', x: 14, z: -8, w: 6, d: 5, h: 5.8, color: '#8595a2', roof: '#e1aa43' },
    { id: 'citytower', kind: 'tower', x: 24, z: -8, w: 4.2, d: 4.2, h: 9.4, color: '#748898', roof: '#f0dc66' },
    { id: 'keep', kind: 'gate', x: -16, z: 5, w: 6, d: 4, h: 5.6, color: '#697783', roof: '#d7bd5a' },
    { id: 'quarry', kind: 'quarry', x: -4, z: 5, w: 5, d: 5, h: -2.8, color: '#7b6e5a', roof: '#9d8f70' },
    { id: 'wonder', kind: 'wonder', x: 12, z: 7, w: 7, d: 7, h: 10.5, color: '#879bad', roof: '#fff06a' },
    { id: 'wall1', kind: 'wall', x: 25, z: 6, w: 7, d: 1, h: 1.8, color: '#6f7b83', roof: '#a99555' },
  ];
  return level;
}

export default function mount() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const state = {
    level: labLevel(),
    camera: { x: 0, z: 0, zoom: 1 },
    hover: null,
    selectedId: null,
    player: { x: 0, z: 14 },
    keys: {},
  };

  function draw() {
    const cv = document.getElementById('render-lab-canvas');
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
    }, rect.width, rect.height);
  }

  function canvasPoint(ev) {
    const rect = ev.currentTarget.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top, w: rect.width, h: rect.height };
  }

  function onCanvasMove(ev) {
    const p = canvasPoint(ev);
    state.hover = screenToTile(p.x, p.y, state.camera, p.w, p.h);
    requestAnimationFrame(draw);
  }

  function onCanvasDown(ev) {
    const p = canvasPoint(ev);
    state.hover = screenToTile(p.x, p.y, state.camera, p.w, p.h);
    state.player = { x: state.hover.x, z: state.hover.z };
    requestAnimationFrame(draw);
  }

  function paint() {
    render(<div className="rl-shell">
      <style>{css}</style>
      <div className="rl-bar"><b>SolCraft Render Lab</b><span>tradjs/client only</span><span>Hover is a diamond. Click moves player. WASD/arrows move. Shift+WASD pans. +/- zooms.</span></div>
      <canvas id="render-lab-canvas" onPointerMove={onCanvasMove} onPointerDown={onCanvasDown} />
    </div>, root);
    requestAnimationFrame(draw);
  }

  function tick() {
    const k = state.keys;
    let dirty = false;
    const step = 0.12;
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
    if (e.key === '+' || e.key === '=') { state.camera.zoom = Math.min(2.4, state.camera.zoom + 0.1); draw(); }
    if (e.key === '-' || e.key === '_') { state.camera.zoom = Math.max(0.55, state.camera.zoom - 0.1); draw(); }
  });
  window.addEventListener('keyup', (e) => { state.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize', () => requestAnimationFrame(draw));

  paint();
  requestAnimationFrame(tick);
}

const css = `
.rl-shell{height:100vh;background:#101918;color:#f2e8c9;font:14px ui-sans-serif,system-ui;display:grid;grid-template-rows:auto 1fr;overflow:hidden}.rl-bar{display:flex;gap:18px;align-items:center;padding:12px 16px;background:#111723;border-bottom:1px solid rgba(255,255,255,.08)}.rl-bar span{color:#bdb49e}canvas{margin:14px;width:calc(100% - 28px);height:calc(100vh - 72px);display:block;border-radius:14px;background:#10221f;box-shadow:0 20px 60px rgba(0,0,0,.35)}
`;
