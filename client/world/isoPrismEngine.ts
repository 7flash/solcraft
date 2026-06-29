export type IsoConfig = { tileW: number; tileH: number };
export type Pt = { x: number; y: number };
export type Footprint = { N: Pt; E: Pt; S: Pt; W: Pt };
export type Sun = { dir: { x: number; y: number; z: number }; ambient: number };
export type Material = { color: string; texture?: HTMLCanvasElement | HTMLImageElement };
export type PrismProp = { kind: 'crate' | 'logs' | 'rock'; dx: number; dy: number; size?: number; color?: string };
export type PrismSpec = {
  id: string;
  kind?: 'building' | 'pit';
  footprint: { w: number; d: number };
  height: number;
  walls: Material;
  rightWall?: Material;
  roof: Material & { overhang?: number };
  foundation?: { color: string; scale?: number };
  decal?: { color: string; blobs?: number };
  stitch?: boolean;
  contactShadow?: boolean;
  props?: PrismProp[];
};
export type PlacedPrism = { spec: PrismSpec; gx: number; gy: number };
export type BakedSprite = { canvas: HTMLCanvasElement; w: number; h: number; anchorX: number; anchorY: number };

const noop = () => {};

export function project(gx: number, gy: number, iso: IsoConfig): Pt {
  return { x: (gx - gy) * iso.tileW / 2, y: (gx + gy) * iso.tileH / 2 };
}

export function footprint(gx: number, gy: number, w: number, d: number, iso: IsoConfig): Footprint {
  return {
    N: project(gx, gy, iso),
    E: project(gx + w, gy, iso),
    S: project(gx + w, gy + d, iso),
    W: project(gx, gy + d, iso),
  };
}

export function center(c: Footprint): Pt {
  return { x: (c.N.x + c.E.x + c.S.x + c.W.x) / 4, y: (c.N.y + c.E.y + c.S.y + c.W.y) / 4 };
}

export function sunFrom(azimuthDeg: number, elevationDeg: number, ambient = 0.46): Sun {
  const az = azimuthDeg * Math.PI / 180;
  const el = elevationDeg * Math.PI / 180;
  const c = Math.cos(el);
  return { dir: { x: c * Math.cos(az), y: c * Math.sin(az), z: Math.sin(el) }, ambient };
}

function brightness(n: { x: number; y: number; z: number }, s: Sun) {
  const d = n.x * s.dir.x + n.y * s.dir.y + n.z * s.dir.z;
  return s.ambient + (1 - s.ambient) * Math.max(0, Math.min(1, d));
}

function shade(hex: string, b: number) {
  const s = String(hex || '#ffffff').replace('#', '').trim();
  const n = Number.parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16) || 0xffffff;
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v * b)));
  return `rgb(${cl((n >> 16) & 255)},${cl((n >> 8) & 255)},${cl(n & 255)})`;
}

class BBox {
  minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
  pt(x: number, y: number) {
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  }
}

function path(ctx: CanvasRenderingContext2D, q: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
  ctx.closePath();
}

function fillPoly(ctx: CanvasRenderingContext2D, q: Pt[], color: string | CanvasGradient, a = 1) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  path(ctx, q);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = prev;
}

function fillFace(ctx: CanvasRenderingContext2D, q: Pt[], mat: Material, b: number) {
  if (mat.texture) {
    const tex = mat.texture;
    const tw = Math.max(1, tex.width || 1);
    const th = Math.max(1, tex.height || 1);
    const o = q[0];
    const u = { x: q[1].x - o.x, y: q[1].y - o.y };
    const v = { x: q[3].x - o.x, y: q[3].y - o.y };
    ctx.save();
    path(ctx, q);
    ctx.clip();
    ctx.setTransform(u.x / tw, u.y / tw, v.x / th, v.y / th, o.x, o.y);
    ctx.drawImage(tex, 0, 0, tw, th);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    const g = Math.round(255 * b);
    fillPoly(ctx, q, `rgb(${g},${g},${g})`, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  } else {
    fillPoly(ctx, q, shade(mat.color, b), 1);
  }
  path(ctx, q);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function contactShadow(ctx: CanvasRenderingContext2D, gc: Pt, r: number, iso: IsoConfig) {
  const g = ctx.createRadialGradient(gc.x, gc.y, 2, gc.x, gc.y, r);
  g.addColorStop(0, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(gc.x, gc.y);
  ctx.scale(1, iso.tileH / iso.tileW);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function isoBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, a: number, iso: IsoConfig) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(1, iso.tileH / iso.tileW);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawDecal(ctx: CanvasRenderingContext2D, gc: Pt, d: NonNullable<PrismSpec['decal']>, iso: IsoConfig) {
  const off = [[-18, 8, 20], [16, 10, 16], [2, -12, 14], [-8, 16, 12], [20, -6, 12], [-22, -2, 12]];
  const n = Math.min(d.blobs ?? 4, off.length);
  for (let i = 0; i < n; i++) isoBlob(ctx, gc.x + off[i][0], gc.y + off[i][1], off[i][2], d.color, 0.3, iso);
}

function drawStitch(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt, k = 3) {
  fillPoly(ctx, [p1, p2, { x: p2.x, y: p2.y - k }, { x: p1.x, y: p1.y - k }], '#2a1f14', 0.4);
}

function drawProp(ctx: CanvasRenderingContext2D, x: number, y: number, pr: PrismProp, iso: IsoConfig) {
  const s = pr.size ?? 16;
  isoBlob(ctx, x, y + s * 0.35, s * 0.9, '#000', 0.28, iso);
  if (pr.kind === 'crate') {
    const col = pr.color ?? '#b08a4a';
    const h = s * 0.9;
    const f = { N: { x, y: y - s * 0.5 }, E: { x: x + s * 0.6, y: y - s * 0.2 }, S: { x, y: y + s * 0.1 }, W: { x: x - s * 0.6, y: y - s * 0.2 } };
    const t = (p: Pt) => ({ x: p.x, y: p.y - h });
    fillPoly(ctx, [f.E, f.S, t(f.S), t(f.E)], shade(col, 0.7), 1);
    fillPoly(ctx, [f.S, f.W, t(f.W), t(f.S)], shade(col, 0.95), 1);
    fillPoly(ctx, [t(f.N), t(f.E), t(f.S), t(f.W)], shade(col, 1.12), 1);
  } else if (pr.kind === 'logs') {
    const col = pr.color ?? '#6f4a2a';
    const log = (lx: number, ly: number) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(lx - 13, ly, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(lx - 13, ly - 7, 26, 14);
      ctx.beginPath();
      ctx.ellipse(lx + 13, ly, 4, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = shade(col, 1.4);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(lx + 13, ly, 2.2, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    };
    log(x - 7, y + 3); log(x + 7, y + 5); log(x, y - 8);
  } else {
    const col = pr.color ?? '#8a8378';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, s * 0.5, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(col, 0.8);
    ctx.beginPath();
    ctx.ellipse(x + s * 0.3, y, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('iso-prism: 2d context unavailable');
  return { canvas, ctx };
}

export function bakeBuilding(spec: PrismSpec, iso: IsoConfig, sun: Sun, log: (name: string, data: any) => void = noop): BakedSprite {
  if (spec.kind === 'pit') return bakePit(spec, iso, sun, log);
  const f = footprint(0, 0, spec.footprint.w, spec.footprint.d, iso);
  const gc = center(f);
  const h = spec.height;
  const hasShadow = spec.contactShadow !== false;
  const fs = spec.foundation?.scale ?? 1.2;
  const ov = spec.roof.overhang ?? 1.1;
  const top = {
    N: { x: f.N.x, y: f.N.y - h }, E: { x: f.E.x, y: f.E.y - h },
    S: { x: f.S.x, y: f.S.y - h }, W: { x: f.W.x, y: f.W.y - h },
  };
  const tc = center(top);
  const roofTop = [top.N, top.E, top.S, top.W].map((p) => ({ x: tc.x + (p.x - tc.x) * ov, y: tc.y + (p.y - tc.y) * ov }));
  const shadowR = (f.E.x - f.W.x) * 0.5 * 1.18 + 6;
  const bb = new BBox();
  if (hasShadow) {
    bb.pt(gc.x - shadowR, gc.y - shadowR * iso.tileH / iso.tileW);
    bb.pt(gc.x + shadowR, gc.y + shadowR * iso.tileH / iso.tileW);
  }
  for (const p of [f.N, f.E, f.S, f.W]) {
    bb.pt(gc.x + (p.x - gc.x) * fs, gc.y + (p.y - gc.y) * fs);
    bb.pt(p.x, p.y - h);
  }
  for (const p of roofTop) bb.pt(p.x, p.y);
  for (const pr of spec.props ?? []) {
    const s = pr.size ?? 16;
    bb.pt(gc.x + pr.dx - s * 1.2, gc.y + pr.dy - s * 1.4);
    bb.pt(gc.x + pr.dx + s * 1.2, gc.y + pr.dy + s);
  }
  const pad = 4;
  const minX = Math.floor(bb.minX - pad), minY = Math.floor(bb.minY - pad);
  const W = Math.ceil(bb.maxX - bb.minX + pad * 2), H = Math.ceil(bb.maxY - bb.minY + pad * 2);
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.translate(-minX, -minY);
  if (hasShadow) contactShadow(ctx, gc, shadowR, iso);
  if (spec.decal) drawDecal(ctx, gc, spec.decal, iso);
  if (spec.foundation) {
    fillPoly(ctx, [f.N, f.E, f.S, f.W].map((p) => ({ x: gc.x + (p.x - gc.x) * fs, y: gc.y + (p.y - gc.y) * fs })), spec.foundation.color, 0.92);
    fillPoly(ctx, [f.N, f.E, f.S, f.W], spec.foundation.color, 0.45);
  }
  fillFace(ctx, [f.E, f.S, top.S, top.E], spec.rightWall ?? spec.walls, brightness({ x: 1, y: 0, z: 0 }, sun));
  fillFace(ctx, [f.S, f.W, top.W, top.S], spec.walls, brightness({ x: 0, y: 1, z: 0 }, sun));
  if (spec.stitch) { drawStitch(ctx, f.E, f.S); drawStitch(ctx, f.S, f.W); }
  fillFace(ctx, roofTop, spec.roof, brightness({ x: 0, y: 0, z: 1 }, sun));
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((roofTop[0].x + roofTop[3].x) / 2, (roofTop[0].y + roofTop[3].y) / 2);
  ctx.lineTo((roofTop[1].x + roofTop[2].x) / 2, (roofTop[1].y + roofTop[2].y) / 2);
  ctx.stroke();
  for (const pr of spec.props ?? []) drawProp(ctx, gc.x + pr.dx, gc.y + pr.dy, pr, iso);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  log('iso.bake', { id: spec.id, w: W, h: H });
  return { canvas, w: W, h: H, anchorX: gc.x - minX, anchorY: gc.y - minY };
}

export function bakePit(spec: PrismSpec, iso: IsoConfig, sun: Sun, log: (name: string, data: any) => void = noop): BakedSprite {
  const f = footprint(0, 0, spec.footprint.w, spec.footprint.d, iso);
  const gc = center(f);
  const depth = Math.max(8, spec.height);
  const s = 0.5;
  const b = (p: Pt) => ({ x: gc.x + (p.x - gc.x) * s, y: gc.y + (p.y - gc.y) * s + depth });
  const bN = b(f.N), bE = b(f.E), bS = b(f.S), bW = b(f.W);
  const bb = new BBox();
  for (const p of [f.N, f.E, f.S, f.W, bN, bE, bS, bW]) bb.pt(p.x, p.y);
  const pad = 4;
  const minX = Math.floor(bb.minX - pad), minY = Math.floor(bb.minY - pad);
  const W = Math.ceil(bb.maxX - bb.minX + pad * 2), H = Math.ceil(bb.maxY - bb.minY + pad * 2);
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.translate(-minX, -minY);
  fillPoly(ctx, [f.N, f.E, f.S, f.W], spec.walls.color, 1);
  fillPoly(ctx, [bN, bE, bS, bW], shade(spec.roof.color, brightness({ x: 0, y: 0, z: 1 }, sun) * 0.8), 1);
  fillPoly(ctx, [f.N, f.E, bE, bN], shade(spec.walls.color, brightness({ x: -1, y: 0, z: 0 }, sun)), 1);
  fillPoly(ctx, [f.N, f.W, bW, bN], shade(spec.walls.color, brightness({ x: 0, y: -1, z: 0 }, sun)), 1);
  path(ctx, [f.N, f.E, f.S, f.W]);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (const pr of spec.props ?? []) drawProp(ctx, gc.x + pr.dx, gc.y + pr.dy, pr, iso);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  log('iso.bakePit', { id: spec.id, w: W, h: H });
  return { canvas, w: W, h: H, anchorX: gc.x - minX, anchorY: gc.y - minY };
}

function hull(pts: Pt[]) {
  const ps = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const p of ps) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

export function drawCastShadow(ctx: CanvasRenderingContext2D, foot: Footprint, height: number, iso: IsoConfig, sun: Sun, alpha = 0.22) {
  const horiz = Math.hypot(sun.dir.x, sun.dir.y) || 1e-3;
  let sdx = (sun.dir.x - sun.dir.y) * iso.tileW / 2;
  let sdy = (sun.dir.x + sun.dir.y) * iso.tileH / 2;
  const m = Math.hypot(sdx, sdy) || 1;
  sdx /= m; sdy /= m;
  const len = height * horiz / Math.max(sun.dir.z, 0.18);
  const off = { x: -sdx * len * 0.5, y: -sdy * len * 0.5 };
  const base = [foot.N, foot.E, foot.S, foot.W];
  const poly = hull(base.concat(base.map((p) => ({ x: p.x + off.x, y: p.y + off.y }))));
  ctx.save();
  ctx.globalAlpha = alpha;
  path(ctx, poly);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

export class SpriteCache {
  private map = new Map<string, BakedSprite>();
  constructor(private iso: IsoConfig, private bucketDeg = 30, private log: (name: string, data: any) => void = noop) {}
  private bucket(sun: Sun) {
    const az = Math.atan2(sun.dir.y, sun.dir.x) * 180 / Math.PI;
    const n = Math.round(360 / this.bucketDeg);
    return (Math.round(az / this.bucketDeg) % n + n) % n;
  }
  get(spec: PrismSpec, sun: Sun) {
    const key = `${spec.id}:${this.bucket(sun)}`;
    let s = this.map.get(key);
    if (!s) { s = bakeBuilding(spec, this.iso, sun, this.log); this.map.set(key, s); }
    return s;
  }
  clear() { this.map.clear(); }
  get size() { return this.map.size; }
}

export function sortKey(p: PlacedPrism) {
  return p.gx + p.spec.footprint.w + (p.gy + p.spec.footprint.d);
}

function footWorld(p: PlacedPrism, cam: Pt, iso: IsoConfig): Footprint {
  const f = footprint(p.gx, p.gy, p.spec.footprint.w, p.spec.footprint.d, iso);
  const a = (q: Pt) => ({ x: q.x + cam.x, y: q.y + cam.y });
  return { N: a(f.N), E: a(f.E), S: a(f.S), W: a(f.W) };
}

export function renderScene(ctx: CanvasRenderingContext2D, cam: Pt, placed: PlacedPrism[], cache: SpriteCache, iso: IsoConfig, sun: Sun, cast = true) {
  const sorted = placed.slice().sort((a, b) => sortKey(a) - sortKey(b) || a.gx - b.gx);
  if (cast) {
    for (const p of sorted) {
      if (p.spec.kind === 'pit') continue;
      drawCastShadow(ctx, footWorld(p, cam, iso), p.spec.height, iso, sun);
    }
  }
  for (const p of sorted) {
    const sp = cache.get(p.spec, sun);
    const gc = center(footWorld(p, cam, iso));
    ctx.drawImage(sp.canvas, Math.round(gc.x - sp.anchorX), Math.round(gc.y - sp.anchorY));
  }
}
