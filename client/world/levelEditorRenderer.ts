export type LevelTileKind = 'grass' | 'dirt' | 'stone' | 'water' | 'plaza' | 'road' | 'dark';
export type LevelObjectKind = 'block' | 'tower' | 'house' | 'roof' | 'wall' | 'gate' | 'quarry' | 'wonder';

export type LevelTile = {
  x: number;
  z: number;
  kind: LevelTileKind;
  elev?: number;
};

export type LevelObject = {
  id: string;
  kind: LevelObjectKind;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  roof: string;
};

export type LevelData = {
  version: 1;
  tiles: LevelTile[];
  objects: LevelObject[];
};

export type EditorCamera = {
  x: number;
  z: number;
  zoom: number;
};

export type RenderEditorState = {
  level: LevelData;
  camera: EditorCamera;
  hover: { x: number; z: number } | null;
  selectedId: string | null;
  player: { x: number; z: number };
  showTileCoords?: boolean;
};

const BASE_TILE_W = 48;
const BASE_TILE_H = 24;
const BASE_HEIGHT = 24;

export const TILE_PALETTE: Array<{ kind: LevelTileKind; label: string; color: string }> = [
  { kind: 'grass', label: 'Grass', color: '#214f39' },
  { kind: 'dirt', label: 'Dirt', color: '#58442c' },
  { kind: 'stone', label: 'Stone', color: '#52606a' },
  { kind: 'water', label: 'Water', color: '#254f68' },
  { kind: 'plaza', label: 'Plaza', color: '#9d8654' },
  { kind: 'road', label: 'Road', color: '#6b5734' },
  { kind: 'dark', label: 'Dark', color: '#10221f' },
];

export const OBJECT_PALETTE: Array<{ kind: LevelObjectKind; label: string; defaults: Partial<LevelObject> }> = [
  { kind: 'block', label: 'Block', defaults: { w: 4, d: 4, h: 2.8, color: '#8495a4', roof: '#d8c267' } },
  { kind: 'tower', label: 'Tower', defaults: { w: 3.25, d: 3.25, h: 7.6, color: '#728392', roof: '#f0dc66' } },
  { kind: 'house', label: 'House', defaults: { w: 4, d: 4, h: 2.4, color: '#b58b4e', roof: '#ead464' } },
  { kind: 'roof', label: 'Roof hall', defaults: { w: 5, d: 4, h: 3.0, color: '#8a7962', roof: '#f6e35a' } },
  { kind: 'wall', label: 'Wall', defaults: { w: 6, d: 1, h: 1.5, color: '#6f7b83', roof: '#a99555' } },
  { kind: 'gate', label: 'Gate', defaults: { w: 5, d: 2, h: 3.0, color: '#6b7684', roof: '#d7bd5a' } },
  { kind: 'quarry', label: 'Quarry pit', defaults: { w: 5, d: 5, h: -2.6, color: '#7b6e5a', roof: '#9d8f70' } },
  { kind: 'wonder', label: 'Wonder', defaults: { w: 6, d: 6, h: 10.0, color: '#879bad', roof: '#fff06a' } },
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function parseHex(hex: string) {
  const s = String(hex || '#ffffff').replace('#', '').trim();
  const n = Number.parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return Number.isFinite(n) ? n : 0xffffff;
}

function colorMul(hex: string, mul: number) {
  const n = parseHex(hex);
  const r = clamp(Math.round(((n >> 16) & 255) * mul), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * mul), 0, 255);
  const b = clamp(Math.round((n & 255) * mul), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function colorAlpha(hex: string, alpha: number) {
  const n = parseHex(hex);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function stableRand(x: number, z: number, salt = 0) {
  let n = Math.imul(Math.trunc(x) + 1013, 374761393) ^ Math.imul(Math.trunc(z) - 9176, 668265263) ^ Math.imul(salt + 41, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function projectIso(x: number, y: number, z: number, camera: EditorCamera, width: number, height: number) {
  const tw = BASE_TILE_W * camera.zoom;
  const th = BASE_TILE_H * camera.zoom;
  const hh = BASE_HEIGHT * camera.zoom;
  const rx = x - camera.x;
  const rz = z - camera.z;
  return {
    x: width * 0.5 + (rx - rz) * tw * 0.5,
    y: height * 0.56 + (rx + rz) * th * 0.5 - y * hh,
  };
}

export function screenToTile(px: number, py: number, camera: EditorCamera, width: number, height: number) {
  const tw = BASE_TILE_W * camera.zoom;
  const th = BASE_TILE_H * camera.zoom;
  const dx = (px - width * 0.5) / tw;
  const dy = (py - height * 0.56) / th;
  return {
    x: Math.round(camera.x + dx + dy),
    z: Math.round(camera.z + dy - dx),
  };
}

export function diamondPath(x: number, z: number, r: number, camera: EditorCamera, width: number, height: number, y = 0) {
  return [
    projectIso(x, y, z - r, camera, width, height),
    projectIso(x + r, y, z, camera, width, height),
    projectIso(x, y, z + r, camera, width, height),
    projectIso(x - r, y, z, camera, width, height),
  ];
}

export function footprintPolygon(o: Pick<LevelObject, 'x' | 'z' | 'w' | 'd'>, camera: EditorCamera, width: number, height: number, y = 0, pad = 0) {
  const hw = (o.w + pad) * 0.5;
  const hd = (o.d + pad) * 0.5;
  // This is an axis-aligned footprint in world tile space. It is not a DOM/screen
  // rectangle; after projection it becomes the diamond/parallelogram footprint that
  // buildings, hover, plates, AO, and picking all share.
  return [
    projectIso(o.x - hw, y, o.z - hd, camera, width, height),
    projectIso(o.x + hw, y, o.z - hd, camera, width, height),
    projectIso(o.x + hw, y, o.z + hd, camera, width, height),
    projectIso(o.x - hw, y, o.z + hd, camera, width, height),
  ];
}

function trace(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, fill: CanvasGradient | string, stroke?: string, lineWidth = 1) {
  trace(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function tileColor(kind: LevelTileKind) {
  const found = TILE_PALETTE.find((p) => p.kind === kind);
  return found?.color || '#214f39';
}

function levelBounds(level: LevelData) {
  let minX = -12, maxX = 12, minZ = -10, maxZ = 12;
  if (level.tiles.length) {
    minX = Math.min(...level.tiles.map((t) => t.x));
    maxX = Math.max(...level.tiles.map((t) => t.x));
    minZ = Math.min(...level.tiles.map((t) => t.z));
    maxZ = Math.max(...level.tiles.map((t) => t.z));
  }
  return { minX, maxX, minZ, maxZ };
}

function drawContinuousGround(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  const { camera, level } = state;
  const bounds = levelBounds(level);
  const pad = 3;
  const base = footprintPolygon({
    x: (bounds.minX + bounds.maxX) * 0.5,
    z: (bounds.minZ + bounds.maxZ) * 0.5,
    w: (bounds.maxX - bounds.minX + 1) + pad * 2,
    d: (bounds.maxZ - bounds.minZ + 1) + pad * 2,
  }, camera, width, height, -0.04, 0);
  const c = projectIso((bounds.minX + bounds.maxX) * 0.5, 0, (bounds.minZ + bounds.maxZ) * 0.5, camera, width, height);
  const g = ctx.createRadialGradient(c.x, c.y, 20, c.x, c.y, Math.max(width, height) * 0.68);
  g.addColorStop(0, '#1d4936');
  g.addColorStop(0.72, '#14352c');
  g.addColorStop(1, '#0e211f');
  fillPoly(ctx, base, g);

  // Draw tiles as overlapping soft material patches, not high-contrast checkers.
  // The editor still has tile-level data, but the visual surface reads as one
  // continuous isometric floor. Hover/selection is the only hard diamond outline.
  const byKind = new Map<LevelTileKind, LevelTile[]>();
  for (const tile of level.tiles) {
    if (!byKind.has(tile.kind)) byKind.set(tile.kind, []);
    byKind.get(tile.kind)!.push(tile);
  }
  const order: LevelTileKind[] = ['water', 'dark', 'stone', 'dirt', 'road', 'plaza', 'grass'];
  for (const kind of order) {
    const list = byKind.get(kind) || [];
    if (!list.length) continue;
    const color = tileColor(kind);
    ctx.save();
    ctx.globalAlpha = kind === 'grass' ? 0.16 : kind === 'road' ? 0.32 : kind === 'plaza' ? 0.42 : kind === 'water' ? 0.50 : 0.30;
    for (const tile of list) {
      const y = Number(tile.elev || 0) * 0.16;
      const pts = diamondPath(tile.x, tile.z, 0.74, camera, width, height, y);
      fillPoly(ctx, pts, colorMul(color, 1.0));
    }
    ctx.restore();
  }

  // Larger authored-looking surface features: worn paths, swales, stone fields.
  for (const obj of level.objects) {
    const p = projectIso(obj.x, 0, obj.z, camera, width, height);
    const r = Math.max(35, (obj.w + obj.d) * 10 * camera.zoom);
    const gg = ctx.createRadialGradient(p.x, p.y + 8 * camera.zoom, 2, p.x, p.y + 8 * camera.zoom, r);
    gg.addColorStop(0, obj.kind === 'quarry' ? 'rgba(74,58,38,0.36)' : 'rgba(132,104,54,0.20)');
    gg.addColorStop(1, 'rgba(132,104,54,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 8 * camera.zoom, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEditorTileHints(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  // Tile hints are deliberately sparse. A permanent full checker grid makes the
  // world read rectangular, even when each individual tile is a diamond.
  if (!state.hover) return;
  const hover = state.hover;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const a = Math.abs(dx) + Math.abs(dz);
      const pts = diamondPath(hover.x + dx, hover.z + dz, 0.5, state.camera, width, height, 0.06);
      fillPoly(ctx, pts, a === 0 ? 'rgba(20,241,149,0.20)' : 'rgba(255,255,255,0.035)', a === 0 ? 'rgba(20,241,149,0.95)' : 'rgba(255,255,255,0.10)');
    }
  }
}

function drawRadialContactShadow(ctx: CanvasRenderingContext2D, o: Pick<LevelObject, 'x' | 'z' | 'w' | 'd'>, camera: EditorCamera, width: number, height: number, alpha = 0.34) {
  const p = projectIso(o.x, 0, o.z, camera, width, height);
  const rx = Math.max(22, (o.w + o.d) * BASE_TILE_W * camera.zoom * 0.18);
  const ry = Math.max(10, (o.w + o.d) * BASE_TILE_H * camera.zoom * 0.16);
  const g = ctx.createRadialGradient(p.x, p.y + 7 * camera.zoom, 1, p.x, p.y + 7 * camera.zoom, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.50, `rgba(0,0,0,${alpha * 0.24})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(p.x, p.y + 8 * camera.zoom);
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.restore();
  ctx.fillStyle = g;
  ctx.fill();
}

function drawFlatPrism(ctx: CanvasRenderingContext2D, o: Pick<LevelObject, 'x' | 'z' | 'w' | 'd'>, camera: EditorCamera, width: number, height: number, y: number, h: number, top: string, left: string, right: string) {
  const hw = o.w * 0.5;
  const hd = o.d * 0.5;
  const p = (xx: number, yy: number, zz: number) => projectIso(xx, yy, zz, camera, width, height);
  const A0 = p(o.x - hw, y, o.z - hd);
  const B0 = p(o.x + hw, y, o.z - hd);
  const C0 = p(o.x + hw, y, o.z + hd);
  const D0 = p(o.x - hw, y, o.z + hd);
  const A1 = p(o.x - hw, y + h, o.z - hd);
  const B1 = p(o.x + hw, y + h, o.z - hd);
  const C1 = p(o.x + hw, y + h, o.z + hd);
  const D1 = p(o.x - hw, y + h, o.z + hd);
  // Only the two front/near faces are drawn. This prevents the “folded/inside out”
  // building look caused by mixing x-constant and z-constant faces.
  fillPoly(ctx, [D0, C0, C1, D1], left, 'rgba(0,0,0,0.13)');
  fillPoly(ctx, [B0, C0, C1, B1], right, 'rgba(0,0,0,0.16)');
  fillPoly(ctx, [A1, B1, C1, D1], top, 'rgba(0,0,0,0.12)');
}

function drawFoundationPlate(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'quarry') return;
  drawFlatPrism(ctx, { ...o, w: o.w + 0.7, d: o.d + 0.7 }, camera, width, height, 0.00, 0.18, '#d0b66f', '#9f824d', '#80683f');
  drawFlatPrism(ctx, { ...o, w: o.w + 0.28, d: o.d + 0.28 }, camera, width, height, 0.18, 0.14, '#dec682', '#b69255', '#8d7344');
}

function drawAoBand(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'quarry') return;
  const pts = footprintPolygon(o, camera, width, height, 0.36, 0.08);
  const c = projectIso(o.x, 0, o.z, camera, width, height);
  ctx.save();
  trace(ctx, pts);
  ctx.clip();
  const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, Math.max(40, (o.w + o.d) * 13 * camera.zoom));
  g.addColorStop(0, 'rgba(0,0,0,0.23)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(c.x - 260, c.y - 120, 520, 240);
  ctx.restore();
}

function drawBuildingCore(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'gate') {
    const a = { ...o, x: o.x - o.w * 0.28, w: o.w * 0.24 };
    const b = { ...o, x: o.x + o.w * 0.28, w: o.w * 0.24 };
    const bridge = { ...o, w: o.w, d: o.d * 0.34, h: o.h * 0.58 };
    drawBuildingCore(ctx, a, camera, width, height);
    drawBuildingCore(ctx, b, camera, width, height);
    drawFlatPrism(ctx, bridge, camera, width, height, 0.38, Math.max(0.2, bridge.h), colorMul(o.roof, 1.05), colorMul(o.color, 0.72), colorMul(o.color, 0.56));
    return;
  }
  if (o.kind === 'wonder') {
    drawFlatPrism(ctx, o, camera, width, height, 0.36, Math.max(0.2, o.h * 0.65), colorMul(o.roof, 1.05), colorMul(o.color, 0.82), colorMul(o.color, 0.62));
    drawFlatPrism(ctx, { ...o, w: o.w * 0.52, d: o.d * 0.52 }, camera, width, height, o.h * 0.65 + 0.36, Math.max(0.2, o.h * 0.35), colorMul(o.roof, 1.18), colorMul(o.color, 0.90), colorMul(o.color, 0.68));
    return;
  }
  drawFlatPrism(ctx, o, camera, width, height, 0.36, Math.max(0.2, o.h), colorMul(o.roof, 1.10), colorMul(o.color, 0.84), colorMul(o.color, 0.64));
}

function drawRoofCap(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (!['house', 'roof'].includes(o.kind)) return;
  const y = Math.max(0.5, o.h + 0.42);
  const ridgeL = projectIso(o.x - o.w * 0.5, y, o.z, camera, width, height);
  const ridgeR = projectIso(o.x + o.w * 0.5, y, o.z, camera, width, height);
  const near = projectIso(o.x, y + 0.58, o.z + o.d * 0.5, camera, width, height);
  const far = projectIso(o.x, y + 0.58, o.z - o.d * 0.5, camera, width, height);
  fillPoly(ctx, [ridgeL, near, ridgeR], colorMul(o.roof, 1.18), 'rgba(0,0,0,0.13)');
  fillPoly(ctx, [ridgeL, far, ridgeR], colorMul(o.roof, 0.86), 'rgba(0,0,0,0.15)');
}

function drawWindowRows(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.h < 2 || ['wall', 'gate', 'quarry'].includes(o.kind)) return;
  const cols = Math.max(2, Math.floor(o.w * 1.0));
  const rows = Math.max(1, Math.floor(o.h * 0.75));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 3 === 1 && o.kind !== 'wonder') continue;
      const fx = o.x - o.w * 0.32 + (i / Math.max(1, cols - 1)) * o.w * 0.64;
      const fy = 0.85 + (j + 0.2) * ((o.h - 1) / Math.max(1, rows));
      const p = projectIso(fx, fy + 0.34, o.z + o.d * 0.5 + 0.02, camera, width, height);
      const s = Math.max(2.4, 3.6 * camera.zoom);
      ctx.fillStyle = 'rgba(35,51,68,0.76)';
      ctx.fillRect(p.x - s, p.y - s, s * 1.35, s * 1.45);
    }
  }
}

function drawClutter(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'quarry') return;
  const spots = [
    [-0.62, -0.08], [0.58, 0.02], [-0.08, 0.62], [0.18, -0.64],
  ];
  for (let i = 0; i < spots.length; i++) {
    if (stableRand(o.x * 10 + i, o.z * 10, 7) < 0.18) continue;
    const [sx, sz] = spots[i];
    const x = o.x + sx * (o.w * 0.5 + 0.45);
    const z = o.z + sz * (o.d * 0.5 + 0.45);
    const p = projectIso(x, 0.18, z, camera, width, height);
    const s = camera.zoom;
    ctx.fillStyle = i % 2 ? '#876a37' : '#5f704b';
    ctx.fillRect(p.x - 3.2 * s, p.y - 7 * s, 6.4 * s, 7 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(p.x - 3.2 * s, p.y, 6.4 * s, 1.8 * s);
  }
}

function drawQuarry(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  drawRadialContactShadow(ctx, o, camera, width, height, 0.20);
  // Raised rim.
  drawFlatPrism(ctx, { ...o, w: o.w + 0.35, d: o.d + 0.35 }, camera, width, height, 0, 0.18, '#a9915d', '#745d38', '#5a4930');
  const rim = footprintPolygon(o, camera, width, height, 0.22, 0.05);
  const inner = footprintPolygon({ ...o, w: Math.max(1, o.w - 1.0), d: Math.max(1, o.d - 1.0) }, camera, width, height, -1.25, 0);
  const c = projectIso(o.x, -0.65, o.z, camera, width, height);
  const g = ctx.createRadialGradient(c.x, c.y, 3, c.x, c.y, Math.max(50, (o.w + o.d) * 10 * camera.zoom));
  g.addColorStop(0, '#302a24');
  g.addColorStop(1, '#675840');
  fillPoly(ctx, rim, '#8b754b');
  fillPoly(ctx, inner, g, 'rgba(0,0,0,0.20)');
  // Sloped pit walls: inverted face selection reads as a sunken negative-height prism.
  for (let i = 0; i < 4; i++) {
    const a = rim[i];
    const b = rim[(i + 1) % 4];
    const c2 = inner[(i + 1) % 4];
    const d2 = inner[i];
    fillPoly(ctx, [a, b, c2, d2], i < 2 ? 'rgba(59,48,36,0.42)' : 'rgba(42,35,29,0.58)');
  }
}

export function drawLevelObject(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number, selected = false) {
  if (o.kind === 'quarry') {
    drawQuarry(ctx, o, camera, width, height);
  } else {
    drawRadialContactShadow(ctx, o, camera, width, height, o.kind === 'wonder' ? 0.38 : 0.28);
    drawFoundationPlate(ctx, o, camera, width, height);
    drawAoBand(ctx, o, camera, width, height);
    drawBuildingCore(ctx, o, camera, width, height);
    drawRoofCap(ctx, o, camera, width, height);
    drawWindowRows(ctx, o, camera, width, height);
    drawClutter(ctx, o, camera, width, height);
  }
  if (selected) {
    fillPoly(ctx, footprintPolygon(o, camera, width, height, 0.42, 0.12), 'rgba(20,241,149,0.13)', 'rgba(20,241,149,0.95)', 2);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: { x: number; z: number }, camera: EditorCamera, width: number, height: number) {
  const pt = projectIso(p.x, 0, p.z, camera, width, height);
  const s = camera.zoom;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y + 7 * s, 11 * s, 5.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22a35a';
  ctx.fillRect(pt.x - 6 * s, pt.y - 20 * s, 12 * s, 18 * s);
  ctx.fillStyle = '#f0c28c';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y - 26 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c2530';
  ctx.fillRect(pt.x - 2 * s, pt.y - 2 * s, 4 * s, 9 * s);
}

export function drawEditorScene(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#10241f');
  bg.addColorStop(1, '#0a1414');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawContinuousGround(ctx, state, width, height);

  const ents = [...state.level.objects]
    .sort((a, b) => (a.x + a.z + Math.max(0, a.h) * 0.08) - (b.x + b.z + Math.max(0, b.h) * 0.08));
  for (const obj of ents) drawLevelObject(ctx, obj, state.camera, width, height, obj.id === state.selectedId);

  drawEditorTileHints(ctx, state, width, height);
  drawPlayer(ctx, state.player, state.camera, width, height);
}

export function objectAtTile(level: LevelData, x: number, z: number) {
  for (let i = level.objects.length - 1; i >= 0; i--) {
    const o = level.objects[i];
    if (Math.abs(x - o.x) <= o.w * 0.5 && Math.abs(z - o.z) <= o.d * 0.5) return o;
  }
  return null;
}

export function defaultLevel(): LevelData {
  const tiles: LevelTile[] = [];
  for (let x = -16; x <= 16; x++) {
    for (let z = -11; z <= 15; z++) {
      let kind: LevelTileKind = 'grass';
      if (Math.abs(x + z) < 2 && x > -11 && x < 12) kind = 'road';
      if (x > 5 && z > 4) kind = 'stone';
      if (x < -10 && z > 6) kind = 'dirt';
      if (x > 10 && z < -4) kind = 'water';
      tiles.push({ x, z, kind, elev: 0 });
    }
  }
  return {
    version: 1,
    tiles,
    objects: [
      { id: 'obj_house', kind: 'house', x: -7, z: -2, w: 4, d: 4, h: 2.4, color: '#b58b4e', roof: '#ead464' },
      { id: 'obj_block', kind: 'block', x: -1, z: -2, w: 4, d: 4, h: 3.0, color: '#8495a4', roof: '#d8c267' },
      { id: 'obj_tower', kind: 'tower', x: 5, z: -3, w: 3.25, d: 3.25, h: 7.4, color: '#728392', roof: '#f0dc66' },
      { id: 'obj_quarry', kind: 'quarry', x: 8, z: 6, w: 5, d: 5, h: -2.6, color: '#7b6e5a', roof: '#9d8f70' },
      { id: 'obj_wonder', kind: 'wonder', x: -2, z: 8, w: 6, d: 6, h: 10.0, color: '#879bad', roof: '#fff06a' },
    ],
  };
}
