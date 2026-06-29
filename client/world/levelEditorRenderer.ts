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
const BASE_HEIGHT = 25;

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
  { kind: 'block', label: 'Block', defaults: { w: 4, d: 4, h: 3.2, color: '#8495a4', roof: '#dbc46b' } },
  { kind: 'tower', label: 'Tower', defaults: { w: 3.4, d: 3.4, h: 7.8, color: '#728392', roof: '#f0dc66' } },
  { kind: 'house', label: 'House', defaults: { w: 4, d: 4, h: 2.8, color: '#b58b4e', roof: '#ead464' } },
  { kind: 'roof', label: 'Roof hall', defaults: { w: 5, d: 4, h: 3.4, color: '#8a7962', roof: '#f6e35a' } },
  { kind: 'wall', label: 'Wall', defaults: { w: 6, d: 1, h: 1.8, color: '#6f7b83', roof: '#a99555' } },
  { kind: 'gate', label: 'Gate', defaults: { w: 5, d: 2, h: 3.6, color: '#6b7684', roof: '#d7bd5a' } },
  { kind: 'quarry', label: 'Quarry pit', defaults: { w: 5, d: 5, h: -2.8, color: '#7b6e5a', roof: '#9d8f70' } },
  { kind: 'wonder', label: 'Wonder', defaults: { w: 7, d: 7, h: 10.5, color: '#879bad', roof: '#fff06a' } },
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

function fillPoly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, fill: CanvasGradient | string, stroke?: string) {
  trace(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function tileColor(kind: LevelTileKind) {
  const found = TILE_PALETTE.find((p) => p.kind === kind);
  return found?.color || '#214f39';
}

function drawTile(ctx: CanvasRenderingContext2D, tile: LevelTile, camera: EditorCamera, width: number, height: number) {
  const y = Number(tile.elev || 0) * 0.16;
  const pts = diamondPath(tile.x, tile.z, 0.53, camera, width, height, y);
  const base = tileColor(tile.kind);
  const c = projectIso(tile.x, y, tile.z, camera, width, height);
  const g = ctx.createLinearGradient(c.x, c.y - 16 * camera.zoom, c.x, c.y + 18 * camera.zoom);
  g.addColorStop(0, colorMul(base, 1.12));
  g.addColorStop(1, colorMul(base, 0.82));
  fillPoly(ctx, pts, g);
}

function drawRadialContactShadow(ctx: CanvasRenderingContext2D, o: Pick<LevelObject, 'x' | 'z' | 'w' | 'd'>, camera: EditorCamera, width: number, height: number, alpha = 0.34) {
  const p = projectIso(o.x, 0, o.z, camera, width, height);
  const rx = Math.max(22, (o.w + o.d) * BASE_TILE_W * camera.zoom * 0.22);
  const ry = Math.max(10, (o.w + o.d) * BASE_TILE_H * camera.zoom * 0.20);
  const g = ctx.createRadialGradient(p.x, p.y + 7 * camera.zoom, 1, p.x, p.y + 7 * camera.zoom, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.48, `rgba(0,0,0,${alpha * 0.25})`);
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

function drawFoundationPlate(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'quarry') return;
  fillPoly(ctx, footprintPolygon(o, camera, width, height, 0.04, 0.9), '#7d663d');
  fillPoly(ctx, footprintPolygon(o, camera, width, height, 0.13, 0.5), '#a98c55');
  fillPoly(ctx, footprintPolygon(o, camera, width, height, 0.22, 0.12), '#d0b66f');
}

function drawAoBand(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'quarry') return;
  const pts = footprintPolygon(o, camera, width, height, 0.25, 0.08);
  const c = projectIso(o.x, 0, o.z, camera, width, height);
  ctx.save();
  trace(ctx, pts);
  ctx.clip();
  const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, Math.max(40, (o.w + o.d) * 14 * camera.zoom));
  g.addColorStop(0, 'rgba(0,0,0,0.20)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(c.x - 240, c.y - 120, 480, 240);
  ctx.restore();
}

function drawPrism(ctx: CanvasRenderingContext2D, x: number, z: number, w: number, d: number, h: number, camera: EditorCamera, width: number, height: number, color: string, roof: string) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const p = (xx: number, yy: number, zz: number) => projectIso(xx, yy, zz, camera, width, height);
  const top = [p(x - hw, h, z - hd), p(x + hw, h, z - hd), p(x + hw, h, z + hd), p(x - hw, h, z + hd)];
  const left = [p(x - hw, 0, z - hd), p(x - hw, 0, z + hd), p(x - hw, h, z + hd), p(x - hw, h, z - hd)];
  const right = [p(x + hw, 0, z - hd), p(x + hw, 0, z + hd), p(x + hw, h, z + hd), p(x + hw, h, z - hd)];
  fillPoly(ctx, left, colorMul(color, 0.82), 'rgba(4,8,10,0.20)');
  fillPoly(ctx, right, colorMul(color, 0.62), 'rgba(4,8,10,0.24)');
  fillPoly(ctx, top, colorMul(roof, 1.12), 'rgba(4,8,10,0.16)');
}

function drawWindowRows(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.h < 2 || ['wall', 'gate', 'quarry'].includes(o.kind)) return;
  const cols = Math.max(2, Math.floor(o.w * 1.1));
  const rows = Math.max(1, Math.floor(o.h * 0.85));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 3 === 1 && o.kind !== 'wonder') continue;
      const fx = o.x - o.w * 0.35 + (i / Math.max(1, cols - 1)) * o.w * 0.7;
      const fy = 0.7 + (j + 0.2) * ((o.h - 1) / Math.max(1, rows));
      const p = projectIso(fx, fy, o.z - o.d * 0.5 - 0.02, camera, width, height);
      const s = Math.max(3, 4.5 * camera.zoom);
      ctx.fillStyle = 'rgba(35,51,68,0.82)';
      ctx.fillRect(p.x - s, p.y - s, s * 1.3, s * 1.45);
    }
  }
}

function drawRoofCap(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (!['house', 'roof', 'gate'].includes(o.kind)) return;
  const y = Math.max(0.5, o.h + 0.15);
  const ridgeA = projectIso(o.x - o.w * 0.5, y, o.z, camera, width, height);
  const ridgeB = projectIso(o.x + o.w * 0.5, y, o.z, camera, width, height);
  const front = projectIso(o.x, y + 0.7, o.z - o.d * 0.5, camera, width, height);
  const back = projectIso(o.x, y + 0.7, o.z + o.d * 0.5, camera, width, height);
  fillPoly(ctx, [ridgeA, front, ridgeB], colorMul(o.roof, 1.22), 'rgba(0,0,0,0.18)');
  fillPoly(ctx, [ridgeA, back, ridgeB], colorMul(o.roof, 0.86), 'rgba(0,0,0,0.18)');
}

function drawClutter(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  if (o.kind === 'quarry') return;
  const spots = [
    [-0.62, -0.08], [0.58, 0.02], [-0.08, 0.62], [0.18, -0.64],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [sx, sz] = spots[i];
    const x = o.x + sx * (o.w * 0.5 + 0.55);
    const z = o.z + sz * (o.d * 0.5 + 0.55);
    const p = projectIso(x, 0.12, z, camera, width, height);
    ctx.fillStyle = i % 2 ? '#876a37' : '#5f6f4a';
    ctx.fillRect(p.x - 4 * camera.zoom, p.y - 8 * camera.zoom, 8 * camera.zoom, 8 * camera.zoom);
  }
}

function drawQuarry(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number) {
  drawRadialContactShadow(ctx, o, camera, width, height, 0.24);
  fillPoly(ctx, footprintPolygon(o, camera, width, height, 0.18, 0.8), '#8b754b');
  fillPoly(ctx, footprintPolygon(o, camera, width, height, -0.45, 0.10), '#544839');
  fillPoly(ctx, footprintPolygon({ ...o, w: Math.max(1, o.w - 1.2), d: Math.max(1, o.d - 1.2) }, camera, width, height, -1.35, 0), '#342d27');
  const lip = footprintPolygon(o, camera, width, height, 0.24, 0.2);
  fillPoly(ctx, lip, 'rgba(210,180,105,0.34)', 'rgba(0,0,0,0.12)');
}

export function drawLevelObject(ctx: CanvasRenderingContext2D, o: LevelObject, camera: EditorCamera, width: number, height: number, selected = false) {
  if (o.kind === 'quarry') {
    drawQuarry(ctx, o, camera, width, height);
  } else {
    drawRadialContactShadow(ctx, o, camera, width, height, o.kind === 'wonder' ? 0.42 : 0.30);
    drawFoundationPlate(ctx, o, camera, width, height);
    drawAoBand(ctx, o, camera, width, height);
    if (o.kind === 'wonder') {
      drawPrism(ctx, o.x, o.z, o.w, o.d, o.h * 0.74, camera, width, height, o.color, o.roof);
      drawPrism(ctx, o.x, o.z, o.w * 0.52, o.d * 0.52, o.h, camera, width, height, colorMul(o.color, 1.08), o.roof);
    } else if (o.kind === 'gate') {
      drawPrism(ctx, o.x - o.w * 0.28, o.z, o.w * 0.22, o.d, o.h, camera, width, height, o.color, o.roof);
      drawPrism(ctx, o.x + o.w * 0.28, o.z, o.w * 0.22, o.d, o.h, camera, width, height, o.color, o.roof);
      drawPrism(ctx, o.x, o.z, o.w, o.d * 0.34, o.h * 0.65, camera, width, height, colorMul(o.color, 1.05), o.roof);
    } else {
      drawPrism(ctx, o.x, o.z, o.w, o.d, Math.max(0.2, o.h), camera, width, height, o.color, o.roof);
    }
    drawRoofCap(ctx, o, camera, width, height);
    drawWindowRows(ctx, o, camera, width, height);
    drawClutter(ctx, o, camera, width, height);
  }
  if (selected) {
    fillPoly(ctx, footprintPolygon(o, camera, width, height, 0.35, 0.16), 'rgba(20,241,149,0.16)', 'rgba(20,241,149,0.95)');
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
}

export function drawEditorScene(ctx: CanvasRenderingContext2D, state: RenderEditorState, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#10241f');
  bg.addColorStop(1, '#0a1414');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (const tile of state.level.tiles) drawTile(ctx, tile, state.camera, width, height);

  if (state.hover) {
    const pts = diamondPath(state.hover.x, state.hover.z, 0.5, state.camera, width, height, 0.04);
    fillPoly(ctx, pts, 'rgba(20,241,149,0.18)', 'rgba(20,241,149,0.90)');
  }

  const ents = [...state.level.objects]
    .sort((a, b) => (a.x + a.z + Math.max(0, a.h) * 0.12) - (b.x + b.z + Math.max(0, b.h) * 0.12));
  for (const obj of ents) drawLevelObject(ctx, obj, state.camera, width, height, obj.id === state.selectedId);
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
  for (let x = -14; x <= 14; x++) {
    for (let z = -10; z <= 14; z++) {
      const kind: LevelTileKind = Math.abs(x + z) < 3 ? 'road' : (x > 5 && z > 5 ? 'stone' : 'grass');
      tiles.push({ x, z, kind, elev: 0 });
    }
  }
  return {
    version: 1,
    tiles,
    objects: [
      { id: 'obj_house', kind: 'house', x: -6, z: -2, w: 4, d: 4, h: 2.8, color: '#b58b4e', roof: '#ead464' },
      { id: 'obj_tower', kind: 'tower', x: 2, z: -3, w: 3.4, d: 3.4, h: 7.4, color: '#728392', roof: '#f0dc66' },
      { id: 'obj_quarry', kind: 'quarry', x: 8, z: 6, w: 5, d: 5, h: -2.8, color: '#7b6e5a', roof: '#9d8f70' },
      { id: 'obj_wonder', kind: 'wonder', x: -1, z: 8, w: 7, d: 7, h: 10.5, color: '#879bad', roof: '#fff06a' },
    ],
  };
}
