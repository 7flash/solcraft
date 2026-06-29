export type RenderLabBuilding = {
  kind: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
};

export type RenderLabState = {
  hover: { x: number; z: number } | null;
  player: { x: number; z: number };
  buildings: RenderLabBuilding[];
};

const TILE_W = 44;
const TILE_H = 22;
const HEIGHT_Y = 24;

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function colorMul(hex: string, mul: number) {
  const s = hex.replace('#', '');
  const n = parseInt(s, 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * mul)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * mul)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * mul)));
  return `rgb(${r},${g},${b})`;
}

function projectIso(x: number, y: number, z: number, ox: number, oy: number) {
  return {
    x: ox + (x - z) * TILE_W * 0.5,
    y: oy + (x + z) * TILE_H * 0.5 - y * HEIGHT_Y,
  };
}

function footprintPolygon(cx: number, cz: number, w: number, d: number, ox: number, oy: number, y = 0) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  return [
    projectIso(cx - hw, y, cz - hd, ox, oy),
    projectIso(cx + hw, y, cz - hd, ox, oy),
    projectIso(cx + hw, y, cz + hd, ox, oy),
    projectIso(cx - hw, y, cz + hd, ox, oy),
  ];
}

function diamondPath(cx: number, cz: number, radius: number, ox: number, oy: number, y = 0) {
  return [
    projectIso(cx, y, cz - radius, ox, oy),
    projectIso(cx + radius, y, cz, ox, oy),
    projectIso(cx, y, cz + radius, ox, oy),
    projectIso(cx - radius, y, cz, ox, oy),
  ];
}

function trace(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, fill: string, stroke?: string) {
  trace(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawRadialContactShadow(ctx: CanvasRenderingContext2D, cx: number, cz: number, w: number, d: number, ox: number, oy: number, alpha = 0.32) {
  const c = projectIso(cx, 0, cz, ox, oy);
  const rx = Math.max(12, (w + d) * TILE_W * 0.2);
  const ry = Math.max(6, (w + d) * TILE_H * 0.18);
  const g = ctx.createRadialGradient(c.x, c.y + 8, 1, c.x, c.y + 8, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.22})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(c.x, (c.y + 8) * (rx / ry), rx, 0, Math.PI * 2);
  ctx.restore();
  ctx.fillStyle = g;
  ctx.fill();
}

function drawFoundationPlate(ctx: CanvasRenderingContext2D, b: RenderLabBuilding, ox: number, oy: number) {
  const outer = footprintPolygon(b.x, b.z, b.w + 1.0, b.d + 1.0, ox, oy, 0.08);
  const mid = footprintPolygon(b.x, b.z, b.w + 0.5, b.d + 0.5, ox, oy, 0.14);
  const inner = footprintPolygon(b.x, b.z, b.w + 0.08, b.d + 0.08, ox, oy, 0.2);
  fillPoly(ctx, outer, '#8e7445');
  fillPoly(ctx, mid, '#b89b61');
  fillPoly(ctx, inner, '#d7bf7d');
}

function drawAoBand(ctx: CanvasRenderingContext2D, b: RenderLabBuilding, ox: number, oy: number) {
  const pts = footprintPolygon(b.x, b.z, b.w + 0.06, b.d + 0.06, ox, oy, 0.22);
  ctx.save();
  trace(ctx, pts);
  ctx.clip();
  const top = projectIso(b.x, 0, b.z, ox, oy);
  const g = ctx.createLinearGradient(top.x, top.y - 20, top.x, top.y + 36);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(top.x - 180, top.y - 20, 360, 80);
  ctx.restore();
}

function drawClutterProp(ctx: CanvasRenderingContext2D, x: number, z: number, ox: number, oy: number, seed: number) {
  const rnd = mulberry32(seed);
  const h = 0.25 + rnd() * 0.25;
  const w = 0.18 + rnd() * 0.16;
  const p0 = projectIso(x - w, 0, z - w, ox, oy);
  const p1 = projectIso(x + w, 0, z - w, ox, oy);
  const p2 = projectIso(x + w, h, z - w, ox, oy);
  const p3 = projectIso(x - w, h, z - w, ox, oy);
  fillPoly(ctx, [p0, p1, p2, p3], '#6a5730');
}

function drawPrism(ctx: CanvasRenderingContext2D, cx: number, cz: number, w: number, d: number, h: number, ox: number, oy: number, base: string, roof?: string) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const top = [
    projectIso(cx - hw, h, cz - hd, ox, oy),
    projectIso(cx + hw, h, cz - hd, ox, oy),
    projectIso(cx + hw, h, cz + hd, ox, oy),
    projectIso(cx - hw, h, cz + hd, ox, oy),
  ];
  const left = [
    projectIso(cx - hw, 0, cz - hd, ox, oy),
    projectIso(cx - hw, 0, cz + hd, ox, oy),
    projectIso(cx - hw, h, cz + hd, ox, oy),
    projectIso(cx - hw, h, cz - hd, ox, oy),
  ];
  const right = [
    projectIso(cx + hw, 0, cz - hd, ox, oy),
    projectIso(cx + hw, 0, cz + hd, ox, oy),
    projectIso(cx + hw, h, cz + hd, ox, oy),
    projectIso(cx + hw, h, cz - hd, ox, oy),
  ];
  fillPoly(ctx, left, colorMul(base, 0.82), 'rgba(0,0,0,0.10)');
  fillPoly(ctx, right, colorMul(base, 0.66), 'rgba(0,0,0,0.12)');
  fillPoly(ctx, top, roof || colorMul(base, 1.24), 'rgba(0,0,0,0.08)');
}

function drawWindows(ctx: CanvasRenderingContext2D, b: RenderLabBuilding, ox: number, oy: number) {
  if (b.h <= 0) return;
  const cols = Math.max(2, Math.floor(b.w * 1.2));
  const rows = Math.max(2, Math.floor(b.h * 1.2));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const fx = b.x - b.w * 0.35 + (i / Math.max(1, cols - 1)) * (b.w * 0.7);
      const fy = 0.6 + j * ((b.h - 1.0) / rows);
      const p = projectIso(fx, fy, b.z - b.d * 0.5 - 0.01, ox, oy);
      ctx.fillStyle = 'rgba(52,70,96,0.85)';
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
    }
  }
}

function buildingPalette(kind: string) {
  switch (kind) {
    case 'house': return { wall: '#c39a57', roof: '#efe170' };
    case 'workshop': return { wall: '#9f7a46', roof: '#d69d3d' };
    case 'vault': return { wall: '#8f8f8a', roof: '#dbcf7a' };
    case 'academy': return { wall: '#8b7ab5', roof: '#d8c4ff' };
    case 'townhall': return { wall: '#8898a8', roof: '#e7a843' };
    case 'citytower': return { wall: '#8492a0', roof: '#f4e56a' };
    case 'keep': return { wall: '#72808e', roof: '#dbc16a' };
    case 'worldwonder': return { wall: '#8ea1b4', roof: '#fff07a' };
    case 'quarry': return { wall: '#7d715f', roof: '#9d917f' };
    default: return { wall: '#8ea1b4', roof: '#e3c86f' };
  }
}

function drawQuarry(ctx: CanvasRenderingContext2D, b: RenderLabBuilding, ox: number, oy: number) {
  drawRadialContactShadow(ctx, b.x, b.z, b.w + 0.8, b.d + 0.8, ox, oy, 0.22);
  drawFoundationPlate(ctx, { ...b, h: 0 }, ox, oy);
  const rim = footprintPolygon(b.x, b.z, b.w, b.d, ox, oy, 0.28);
  fillPoly(ctx, rim, '#9c875c');
  const pit = footprintPolygon(b.x, b.z, b.w - 0.8, b.d - 0.8, ox, oy, -1.6);
  fillPoly(ctx, pit, '#544a3d');
  const inner = footprintPolygon(b.x, b.z, b.w - 1.4, b.d - 1.4, ox, oy, -2.0);
  fillPoly(ctx, inner, '#3e352c');
  for (let i = 0; i < 6; i++) {
    const ang = i * Math.PI / 3;
    drawClutterProp(ctx, b.x + Math.cos(ang) * 1.6, b.z + Math.sin(ang) * 1.2, ox, oy, i + 20);
  }
}

function drawBuildingUnit(ctx: CanvasRenderingContext2D, b: RenderLabBuilding, ox: number, oy: number) {
  if (b.kind === 'quarry') return drawQuarry(ctx, b, ox, oy);
  const pal = buildingPalette(b.kind);
  drawRadialContactShadow(ctx, b.x, b.z, b.w + 1.0, b.d + 1.0, ox, oy, b.kind === 'worldwonder' ? 0.42 : 0.28);
  drawFoundationPlate(ctx, b, ox, oy);
  drawAoBand(ctx, b, ox, oy);
  drawPrism(ctx, b.x, b.z, b.w, b.d, b.h, ox, oy, pal.wall, pal.roof);
  drawWindows(ctx, b, ox, oy);
  const ring = Math.max(b.w, b.d) * 0.65;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    drawClutterProp(ctx, b.x + Math.cos(a) * ring, b.z + Math.sin(a) * ring, ox, oy, i + b.x * 17 + b.z * 31);
  }
}

function drawGround(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  ctx.fillStyle = '#112421';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const rnd = mulberry32(12345);
  for (let i = 0; i < 26; i++) {
    const x = -30 + rnd() * 60;
    const z = -18 + rnd() * 42;
    const p = projectIso(x, 0, z, ox, oy);
    const r = 30 + rnd() * 65;
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
    g.addColorStop(0, 'rgba(64,104,82,0.22)');
    g.addColorStop(1, 'rgba(64,104,82,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHover(ctx: CanvasRenderingContext2D, hover: { x: number; z: number } | null, ox: number, oy: number) {
  if (!hover) return;
  const pts = diamondPath(hover.x, hover.z, 0.5, ox, oy, 0.02);
  fillPoly(ctx, pts, 'rgba(115,203,174,0.18)', 'rgba(132,240,205,0.92)');
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: { x: number; z: number }, ox: number, oy: number) {
  const p = projectIso(player.x, 0, player.z, ox, oy);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 8, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f8e53';
  ctx.fillRect(p.x - 6, p.y - 18, 12, 18);
  ctx.fillStyle = '#e9c08b';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 24, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#161616';
  ctx.fillRect(p.x - 2, p.y - 4, 4, 10);
}

export function drawRenderLabScene(ctx: CanvasRenderingContext2D, state: RenderLabState, width: number, height: number) {
  const ox = width * 0.5;
  const oy = height * 0.58;
  drawGround(ctx, ox, oy);

  const sorted = [...state.buildings].sort((a, b) => (a.x + a.z) - (b.x + b.z));
  for (const b of sorted) drawBuildingUnit(ctx, b, ox, oy);
  drawHover(ctx, state.hover, ox, oy);
  drawPlayer(ctx, state.player, ox, oy);
}
