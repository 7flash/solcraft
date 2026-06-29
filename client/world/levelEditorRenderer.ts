import {
  SpriteCache,
  center,
  footprint,
  project,
  renderScene,
  sunFrom,
  type IsoConfig,
  type PlacedPrism,
  type PrismSpec,
} from './isoPrismEngine';

export type LevelTileKind = 'grass' | 'dirt' | 'stone' | 'water' | 'plaza' | 'road' | 'dark';
export type LevelObjectKind = 'block' | 'tower' | 'house' | 'roof' | 'wall' | 'gate' | 'quarry' | 'wonder';

export type LevelTile = { x: number; z: number; kind: LevelTileKind; elev?: number };
export type LevelObject = {
  id: string;
  kind: LevelObjectKind;
  // x/z are grid-corner anchors, not visual centers. This follows the proven
  // iso-prism sample: footprint(x,z,w,d) owns [x,x+w) × [z,z+d). Hover,
  // picking, tiles, shadows, foundations, and sprite anchors all share it.
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
};
export type LevelData = { version: 1; tiles: LevelTile[]; objects: LevelObject[] };
export type EditorCamera = { x: number; z: number; zoom: number };
export type RenderEditorState = {
  level: LevelData;
  camera: EditorCamera;
  hover: { x: number; z: number } | null;
  selectedId: string | null;
  player: { x: number; z: number };
  showTileCoords?: boolean;
  previewFootprint?: { w: number; d: number } | null;
};

const ISO_BASE: IsoConfig = { tileW: 72, tileH: 36 };
const HEIGHT_UNIT = 28;
const cacheByScale = new Map<string, SpriteCache>();

export const TILE_PALETTE: Array<{ kind: LevelTileKind; label: string; color: string }> = [
  { kind: 'grass', label: 'Grass', color: '#32442e' },
  { kind: 'dirt', label: 'Dirt', color: '#5c4931' },
  { kind: 'stone', label: 'Stone', color: '#53606a' },
  { kind: 'water', label: 'Water', color: '#254f68' },
  { kind: 'plaza', label: 'Plaza', color: '#8f7648' },
  { kind: 'road', label: 'Road', color: '#6b5734' },
  { kind: 'dark', label: 'Dark', color: '#10221f' },
];

export const OBJECT_PALETTE: Array<{ kind: LevelObjectKind; label: string; defaults: Partial<LevelObject> }> = [
  { kind: 'block', label: 'Block', defaults: { w: 1, d: 1, h: 3.2, color: '#8495a4', roof: '#d8c267' } },
  { kind: 'tower', label: 'Tower', defaults: { w: 1, d: 1, h: 6.2, color: '#728392', roof: '#f0dc66' } },
  { kind: 'house', label: 'House', defaults: { w: 2, d: 2, h: 2.1, color: '#b58b4e', roof: '#ead464' } },
  { kind: 'roof', label: 'Roof hall', defaults: { w: 3, d: 2, h: 2.6, color: '#8a7962', roof: '#f6e35a' } },
  { kind: 'wall', label: 'Wall', defaults: { w: 3, d: 1, h: 1.2, color: '#6f7b83', roof: '#a99555' } },
  { kind: 'gate', label: 'Gate', defaults: { w: 3, d: 1, h: 2.8, color: '#6b7684', roof: '#d7bd5a' } },
  { kind: 'quarry', label: 'Quarry pit', defaults: { w: 2, d: 2, h: -1.5, color: '#3a2c1d', roof: '#5e4a34' } },
  { kind: 'wonder', label: 'Wonder', defaults: { w: 3, d: 3, h: 8.5, color: '#879bad', roof: '#fff06a' } },
];

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function colorForTile(kind: LevelTileKind) { return TILE_PALETTE.find((p) => p.kind === kind)?.color || '#32442e'; }
function colorMul(hex: string, mul: number) {
  const s = String(hex || '#ffffff').replace('#', '').trim();
  const n = Number.parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16) || 0xffffff;
  const r = clamp(Math.round(((n >> 16) & 255) * mul), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * mul), 0, 255);
  const b = clamp(Math.round((n & 255) * mul), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function isoFor(camera: EditorCamera): IsoConfig {
  return { tileW: ISO_BASE.tileW * camera.zoom, tileH: ISO_BASE.tileH * camera.zoom };
}
function worldOrigin(camera: EditorCamera, width: number, height: number) {
  const iso = isoFor(camera);
  const cam = project(camera.x, camera.z, iso);
  return { x: width * 0.5 - cam.x, y: height * 0.58 - cam.y };
}
function worldPoint(gx: number, gz: number, camera: EditorCamera, width: number, height: number) {
  const iso = isoFor(camera);
  const o = worldOrigin(camera, width, height);
  const p = project(gx, gz, iso);
  return { x: p.x + o.x, y: p.y + o.y };
}

export function screenToTile(px: number, py: number, camera: EditorCamera, width: number, height: number) {
  const iso = isoFor(camera);
  const o = worldOrigin(camera, width, height);
  const wx = px - o.x;
  const wy = py - o.y;
  const a = 2 * wx / iso.tileW;
  const b = 2 * wy / iso.tileH;
  return { x: Math.floor((a + b) / 2), z: Math.floor((b - a) / 2) };
}

function trace(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
function fillPoly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, fill: string | CanvasGradient, stroke?: string, lineWidth = 1) {
  trace(ctx, pts); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}
function tileDiamond(gx: number, gz: number, w: number, d: number, camera: EditorCamera, width: number, height: number) {
  const iso = isoFor(camera);
  const o = worldOrigin(camera, width, height);
  const f = footprint(gx, gz, w, d, iso);
  return [f.N, f.E, f.S, f.W].map((p) => ({ x: p.x + o.x, y: p.y + o.y }));
}

function levelBounds(level: LevelData) {
  let minX = -12, maxX = 12, minZ = -10, maxZ = 12;
  if (level.tiles.length) {
    minX = Math.min(...level.tiles.map((t) => t.x)); maxX = Math.max(...level.tiles.map((t) => t.x));
    minZ = Math.min(...level.tiles.map((t) => t.z)); maxZ = Math.max(...level.tiles.map((t) => t.z));
  }
  for (const o of level.objects) {
    minX = Math.min(minX, o.x); maxX = Math.max(maxX, o.x + o.w);
    minZ = Math.min(minZ, o.z); maxZ = Math.max(maxZ, o.z + o.d);
  }
  return { minX, maxX, minZ, maxZ };
}

function drawGround(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  const { level, camera } = state;
  const b = levelBounds(level);
  const p = worldPoint((b.minX + b.maxX) * 0.5, (b.minZ + b.maxZ) * 0.5, camera, width, height);
  const bg = ctx.createRadialGradient(p.x, p.y, 12, p.x, p.y, Math.max(width, height) * 0.62);
  bg.addColorStop(0, '#233a30'); bg.addColorStop(0.72, '#142b27'); bg.addColorStop(1, '#0c1818');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);

  // Proper tiles: each tile is the same corner-origin diamond used by placement
  // footprints. They are low contrast so the board does not read as a rectangle.
  for (const t of level.tiles) {
    const pts = tileDiamond(t.x, t.z, 1, 1, camera, width, height);
    const col = colorForTile(t.kind);
    ctx.save();
    ctx.globalAlpha = t.kind === 'grass' ? 0.34 : t.kind === 'road' ? 0.50 : t.kind === 'plaza' ? 0.58 : t.kind === 'water' ? 0.62 : 0.44;
    fillPoly(ctx, pts, col);
    ctx.restore();
  }

  // Material joins: draw soft blobs over authored tile clusters instead of using
  // high-frequency checker noise. This is the key lesson from the sample: tiles
  // stay geometrically exact; material identity can be blended above them.
  for (const t of level.tiles) {
    if (t.kind === 'grass') continue;
    const c = worldPoint(t.x + 0.5, t.z + 0.5, camera, width, height);
    const r = Math.max(20, 34 * camera.zoom);
    const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, r);
    g.addColorStop(0, `${colorForTile(t.kind)}aa`);
    g.addColorStop(1, `${colorForTile(t.kind)}00`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function objectSpec(o: LevelObject): PrismSpec {
  const base: PrismSpec = {
    id: `${o.id}:${o.kind}:${o.w}:${o.d}:${o.h}:${o.color}:${o.roof}`,
    kind: o.kind === 'quarry' ? 'pit' : 'building',
    footprint: { w: Math.max(0.25, o.w), d: Math.max(0.25, o.d) },
    height: Math.max(8, Math.abs(o.h) * HEIGHT_UNIT),
    walls: { color: o.color },
    rightWall: { color: colorMul(o.color, 0.92) },
    roof: { color: o.roof, overhang: ['house', 'roof', 'wonder'].includes(o.kind) ? 1.14 : 1.06 },
    foundation: o.kind === 'quarry' ? undefined : { color: o.kind === 'wonder' ? '#7d6840' : '#5b4633', scale: o.kind === 'wonder' ? 1.16 : 1.10 },
    decal: o.kind === 'quarry' ? undefined : { color: '#6e5538', blobs: o.kind === 'wonder' ? 5 : 3 },
    stitch: o.kind !== 'quarry',
    contactShadow: o.kind !== 'quarry',
    props: [],
  };
  if (o.kind === 'house') base.props = [{ kind: 'crate', dx: 24, dy: 4, size: 14 }, { kind: 'logs', dx: -26, dy: 7, size: 14 }];
  if (o.kind === 'wall') { base.roof.overhang = 1.00; base.foundation = { color: '#40392e', scale: 1.04 }; }
  if (o.kind === 'gate') base.props = [{ kind: 'crate', dx: -34, dy: 6, size: 15 }, { kind: 'crate', dx: 34, dy: 6, size: 15 }];
  if (o.kind === 'quarry') base.props = [{ kind: 'rock', dx: -36, dy: -8, size: 16 }, { kind: 'rock', dx: 30, dy: 4, size: 14 }];
  return base;
}

function placedObjects(level: LevelData): PlacedPrism[] {
  return level.objects.map((o) => ({ spec: objectSpec(o), gx: o.x, gy: o.z }));
}

function drawSelection(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  const sel = state.level.objects.find((o) => o.id === state.selectedId);
  if (sel) fillPoly(ctx, tileDiamond(sel.x, sel.z, sel.w, sel.d, state.camera, width, height), 'rgba(20,241,149,0.13)', 'rgba(20,241,149,0.95)', 2);
}

function drawHover(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  if (!state.hover) return;
  const h = state.hover;
  const fp = state.previewFootprint || { w: 1, d: 1 };
  const pts = tileDiamond(h.x, h.z, fp.w, fp.d, state.camera, width, height);
  fillPoly(ctx, pts, state.previewFootprint ? 'rgba(20,241,149,0.12)' : 'rgba(255,255,255,0.06)', state.previewFootprint ? 'rgba(20,241,149,0.88)' : 'rgba(255,255,255,0.22)', state.previewFootprint ? 2 : 1);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: { x: number; z: number }, camera: EditorCamera, width: number, height: number) {
  const pt = worldPoint(p.x + 0.5, p.z + 0.5, camera, width, height);
  const s = camera.zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.beginPath(); ctx.ellipse(pt.x, pt.y + 7 * s, 11 * s, 5.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22a35a'; ctx.fillRect(pt.x - 6 * s, pt.y - 20 * s, 12 * s, 18 * s);
  ctx.fillStyle = '#f0c28c'; ctx.beginPath(); ctx.arc(pt.x, pt.y - 26 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c2530'; ctx.fillRect(pt.x - 2 * s, pt.y - 2 * s, 4 * s, 9 * s);
}

function cacheFor(camera: EditorCamera) {
  const key = `${Math.round(camera.zoom * 100)}`;
  let cache = cacheByScale.get(key);
  if (!cache) { cache = new SpriteCache(isoFor(camera), 30); cacheByScale.set(key, cache); }
  return cache;
}

export function drawEditorScene(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  drawGround(ctx, state, width, height);
  const sun = sunFrom(40, 52, 0.46);
  renderScene(ctx, worldOrigin(state.camera, width, height), placedObjects(state.level), cacheFor(state.camera), isoFor(state.camera), sun, true);
  drawSelection(ctx, state, width, height);
  drawHover(ctx, state, width, height);
  drawPlayer(ctx, state.player, state.camera, width, height);
}

export function objectAtTile(level: LevelData, x: number, z: number) {
  // Same [x,x+w) × [z,z+d) corner-origin footprint as the sample. This prevents
  // rectangular hover/pick mismatches and makes quarry/plate/wall ownership exact.
  for (let i = level.objects.length - 1; i >= 0; i--) {
    const o = level.objects[i];
    if (x >= o.x && x < o.x + o.w && z >= o.z && z < o.z + o.d) return o;
  }
  return null;
}

export function defaultLevel(): LevelData {
  const tiles: LevelTile[] = [];
  for (let x = -13; x <= 15; x++) {
    for (let z = -9; z <= 13; z++) {
      let kind: LevelTileKind = 'grass';
      if (Math.abs(x + z) < 2 && x > -9 && x < 10) kind = 'road';
      if (x > 7 && z > 4) kind = 'stone';
      if (x < -9 && z > 5) kind = 'dirt';
      if (x > 10 && z < -4) kind = 'water';
      tiles.push({ x, z, kind, elev: 0 });
    }
  }
  return {
    version: 1,
    tiles,
    objects: [
      { id: 'obj_house', kind: 'house', x: -7, z: -2, w: 2, d: 2, h: 2.1, color: '#b58b4e', roof: '#ead464' },
      { id: 'obj_block', kind: 'block', x: -3, z: -2, w: 1, d: 1, h: 3.2, color: '#8495a4', roof: '#d8c267' },
      { id: 'obj_tower', kind: 'tower', x: 2, z: -3, w: 1, d: 1, h: 6.2, color: '#728392', roof: '#f0dc66' },
      { id: 'obj_quarry', kind: 'quarry', x: 5, z: 5, w: 2, d: 2, h: -1.5, color: '#3a2c1d', roof: '#5e4a34' },
      { id: 'obj_wonder', kind: 'wonder', x: -3, z: 6, w: 3, d: 3, h: 8.5, color: '#879bad', roof: '#fff06a' },
    ],
  };
}
