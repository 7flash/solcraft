// @ts-nocheck
import { buildingRecipeFor, recipeVisibleParts, type PrismRecipePart } from "./buildingRecipes";
import { resourceRecipeFor, type ResourcePrismPart } from "./resourceRecipes";

type Pt = { x: number; y: number };
type CanvasWorldOptions = {
  host: HTMLElement;
  state: any;
  sendAction?: (type: string, payload?: any) => Promise<any>;
  say?: (msg: string, ms?: number) => void;
  pollSoon?: () => void;
  key?: (x: number, z: number) => string;
  cheb?: (ax: number, az: number, bx: number, bz: number) => number;
  n8?: Array<[number, number]>;
  currentTileLoadRadius?: () => number;
  capitalBuildingsInView?: (ax: number, az: number, r: number) => any[];
  tradePostAt?: (x: number, z: number) => any;
  proceduralNpcAt?: (x: number, z: number) => any;
  biomeTerrainAt?: (x: number, z: number) => string;
  naturalDoodad?: (x: number, z: number) => string | null;
  hrand?: (x: number, z: number, s?: number) => number;
  onHop?: () => void;
  onError?: () => void;
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function cssHex(value: any, fallback = "#d6604f") {
  const s = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}
function hexToRgb(hex: string) {
  const h = cssHex(hex, "#000000").slice(1);
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgbToCss(c: number[], a = 1) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function shadeHex(hex: string, amount: number) {
  const c = hexToRgb(hex); const target = amount >= 0 ? 255 : 0; const a = Math.abs(amount);
  const out = c.map((v) => Math.round(v + (target - v) * a));
  return `#${out.map(v=>clamp(v,0,255).toString(16).padStart(2,"0")).join("")}`;
}
function mixRgb(a: number[], b: number[], t: number) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function tint(hex: string, f = 1, tintRgb: number[] | null = null) {
  const c = hexToRgb(hex).map(v => v * f);
  const t = tintRgb || [1,1,1];
  return rgbToCss([clamp(c[0] * t[0],0,255), clamp(c[1] * t[1],0,255), clamp(c[2] * t[2],0,255)]);
}
function keyOf(x: number, z: number) { return `${Math.trunc(x)},${Math.trunc(z)}`; }
function stableRand(x: number, z: number, s = 0) {
  let n = (Math.imul(Math.trunc(x) + 1013, 374761393) ^ Math.imul(Math.trunc(z) + 9176, 668265263) ^ Math.imul(s + 1447, 2246822519)) >>> 0;
  n ^= n >> 13; n = Math.imul(n, 1274126177) >>> 0; n ^= n >> 16;
  return (n >>> 0) / 4294967295;
}
function numColorToHex(v: any, fallback = "#14f195") {
  if (typeof v === "number" && Number.isFinite(v)) return `#${(v >>> 0).toString(16).slice(-6).padStart(6,"0")}`;
  return cssHex(v, fallback);
}

export function createCanvasPrismWorld(opts: CanvasWorldOptions) {
  const host = opts.host;
  const ST = opts.state || {};
  const kfn = opts.key || keyOf;
  const cheb = opts.cheb || ((ax:number,az:number,bx:number,bz:number)=>Math.max(Math.abs(ax-bx),Math.abs(az-bz)));
  const n8 = opts.n8 || [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  host.classList.add("sc-canvas-world-host");
  host.querySelectorAll("canvas").forEach((n) => { try { n.remove(); } catch {} });
  const canvas = document.createElement("canvas");
  canvas.className = "sc-canvas-world";
  canvas.setAttribute("aria-label", "SolCraft canvas prism world");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false })!;

  let dpr = 1, width = 1, height = 1;
  let tileW = 54, tileH = 27, heightScale = 46;
  let cameraX = 0, cameraY = 0;
  let targetCameraX = 0, targetCameraY = 0;
  let zoomValue = 1;
  let disposed = false;
  let raf = 0;
  let lastFrame = performance.now();
  let lastStepAt = 0;
  let moveSeq = 0, ackSeq = 0, inFlight = 0;
  const maxInFlight = 4;

  const me = { id: 0, x: 0, z: 0, name: "", body: 0x14f195, hat: 0x7dcfe8, walking: false, walkPhase: 0, facingX: 0, facingZ: 1 };
  let lastAuthoritative = { x: 0, z: 0 };
  const remotes: any[] = [];
  const playersById = new Map<any, any>();
  const tileOwner = new Map<string, any>();
  const buildPool = new Map<any, any>();
  const buildAt = new Map<string, any>();
  const lootPool = new Map<any, any>();
  const rigPool = new Map<any, any>();
  const tradePostPool = new Map<any, any>();
  const cells = new Map<string, any>();
  const doodads = new Map<string, any>();
  const exceptions = new Map<string, any>();
  let hintCells: any[] = [];
  let ghost: any = null;
  let pendingPath: Array<{x:number,z:number}> = [];
  const floaters: any[] = [];
  const bursts: any[] = [];
  const staticGroundMarks: any[] = [];
  const minGroundMarks = 240;
  let lastVisibleCenter = { x: 1e9, z: 1e9, r: 0 };

  const hoverMarker = {
    visible: false,
    position: { x: 0, z: 0 },
    material: { color: { _hex: "#14f195", set(v: any) { this._hex = numColorToHex(v, "#14f195"); } } },
  } as any;

  function resize() {
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth || window.innerWidth || 1);
    const h = Math.max(1, host.clientHeight || window.innerHeight || 1);
    if (w === width && h === height && nextDpr === dpr) return;
    dpr = nextDpr; width = w; height = h;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function visualZoom() { return clamp(Number(ST.visual?.cameraZoom || 1) || 1, 0.72, 1.55) * zoomValue; }
  function updateProjection() {
    const z = visualZoom();
    tileW = 58 * z; tileH = 29 * z; heightScale = 48 * z;
  }
  function proj(wx: number, wy = 0, wz: number): Pt {
    return { x: cameraX + (wx - wz) * tileW, y: cameraY + (wx + wz) * tileH - wy * heightScale };
  }
  function screenToWorld(sx: number, sy: number) {
    const dx = (sx - cameraX) / tileW, dy = (sy - cameraY) / tileH;
    return { wx: (dx + dy) / 2, wz: (dy - dx) / 2 };
  }
  function poly(pts: Pt[], fill: string, stroke = "") {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.5, visualZoom() * 0.62); ctx.stroke(); }
  }
  function drawDiamond(cx: number, z: number, color: string, alpha = 1, lift = 0.01, scale = 1) {
    const half = scale * 0.5;
    const a = proj(cx - half, lift, z), b = proj(cx, lift, z - half), c = proj(cx + half, lift, z), d = proj(cx, lift, z + half);
    poly([a,b,c,d], color.replace(/\)$/, `,${alpha})`).replace("rgb(", "rgba("));
  }
  function faceGradient(a: Pt, b: Pt, c: Pt, d: Pt, top: string, bottom: string) {
    const g = ctx.createLinearGradient((a.x+b.x)/2, (a.y+b.y)/2, (c.x+d.x)/2, (c.y+d.y)/2);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    return g;
  }
  function lightForTime() {
    const hour = currentHour();
    const day = hour >= 7 && hour <= 18;
    const dusk = hour < 7 || hour > 18;
    return {
      tint: day ? [1.02, 0.99, 0.92] : [0.78, 0.88, 1.05],
      top: day ? 1.08 : 0.82,
      left: day ? 0.74 : 0.58,
      right: day ? 0.60 : 0.48,
      shadow: day ? 0.18 : 0.28,
      dusk,
    };
  }
  function currentHour() {
    try {
      const controls = ST.timeControls || { auto: true, hour: 12 };
      if (controls.auto === false) return Math.max(0, Math.min(23, Math.floor(Number(controls.hour ?? 12))));
      const dayMs = 20 * 60 * 1000;
      return Math.floor((((Date.now() % dayMs) + dayMs) % dayMs) / dayMs * 24);
    } catch { return 12; }
  }
  function drawPrismMin(x: number, z: number, y: number, w: number, d: number, h: number, top: string, left?: string, right?: string, alpha = 1) {
    const L = lightForTime();
    const x0 = x, z0 = z, y0 = y, x1 = x + w, z1 = z + d, y1 = y + h;
    const at = proj(x0,y1,z0), bt = proj(x1,y1,z0), ct = proj(x1,y1,z1), dt = proj(x0,y1,z1);
    const b0 = proj(x1,y0,z0), c0 = proj(x1,y0,z1), d0 = proj(x0,y0,z1);
    const topHex = cssHex(top, "#c79a45");
    const leftHex = cssHex(left || shadeHex(topHex, -0.22), shadeHex(topHex, -0.22));
    const rightHex = cssHex(right || shadeHex(topHex, -0.34), shadeHex(topHex, -0.34));
    const l1 = tint(leftHex, L.left * 1.10, L.tint), l2 = tint(leftHex, L.left * 0.72, L.tint);
    const r1 = tint(rightHex, L.right * 1.10, L.tint), r2 = tint(rightHex, L.right * 0.72, L.tint);
    poly([d0,c0,ct,dt], faceGradient(d0,c0,ct,dt,l1,l2) as any, `rgba(16,22,18,${0.20 * alpha})`);
    poly([c0,b0,bt,ct], faceGradient(c0,b0,bt,ct,r1,r2) as any, `rgba(10,15,13,${0.22 * alpha})`);
    poly([at,bt,ct,dt], tint(topHex, L.top, L.tint), `rgba(20,18,12,${0.18 * alpha})`);
  }
  function drawRecipePart(originX: number, originZ: number, part: PrismRecipePart, scale: number, alpha = 1) {
    const w = part.w * scale, d = part.d * scale;
    const x = originX + part.x * scale - w / 2;
    const z = originZ + part.z * scale - d / 2;
    drawPrismMin(x, z, part.y * scale, w, d, part.h * scale, part.top, part.left, part.right, alpha);
  }
  function drawResourcePart(originX: number, originZ: number, part: ResourcePrismPart, scale: number) {
    const w = part.w * scale, d = part.d * scale;
    const x = originX + part.ox * scale - w / 2;
    const z = originZ + part.oz * scale - d / 2;
    drawPrismMin(x, z, part.y * scale, w, d, part.h * scale, part.top, part.left, part.right);
  }
  function drawShadow(cx: number, z: number, rx = 0.8, ry = 0.42, alpha = 0.18) {
    const p = proj(cx + 0.13, 0.02, z + 0.10);
    ctx.fillStyle = `rgba(6,12,10,${alpha})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * tileW, ry * tileH, 0, 0, Math.PI * 2); ctx.fill();
  }
  function terrainColor(x: number, z: number) {
    const owner = tileOwner.get(kfn(x,z));
    const biome = opts.biomeTerrainAt?.(x,z) || "grass";
    let base = biome === "sand" ? [116,96,54] : biome === "water" ? [38,80,82] : [43,82,62];
    if (owner) base = mixRgb(base, hexToRgb(numColorToHex(owner.body || owner.ownerBody || "#14f195", "#14f195")), 0.20);
    const r = stableRand(x,z,17) - 0.5;
    return rgbToCss([base[0] + r*14, base[1] + r*14, base[2] + r*14]);
  }
  function drawTerrain() {
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.round(me.x), cz = Math.round(me.z);
    const minX = cx - r, maxX = cx + r, minZ = cz - r, maxZ = cz + r;
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (Math.max(Math.abs(x-cx), Math.abs(z-cz)) > r) continue;
      const a = proj(x - 0.5, 0, z), b = proj(x, 0, z - 0.5), c = proj(x + 0.5, 0, z), d = proj(x, 0, z + 0.5);
      poly([a,b,c,d], terrainColor(x,z), "");
      if (stableRand(x,z,101) > 0.86) {
        const p = proj(x + (stableRand(x,z,4)-0.5)*0.42, 0.016, z + (stableRand(x,z,5)-0.5)*0.42);
        const w = (0.12 + stableRand(x,z,6)*0.22) * tileW;
        const h = (0.018 + stableRand(x,z,7)*0.030) * tileW;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate((stableRand(x,z,8)-0.5)*1.3); ctx.fillStyle = stableRand(x,z,9)>0.55 ? "rgba(177,156,104,0.10)" : "rgba(189,218,187,0.08)"; ctx.fillRect(-w/2,-h/2,w,h); ctx.restore();
      }
    }
    // Larger authored scuff sheets, deterministic around the player. These are
    // visible enough to kill the green void but quiet enough to avoid the old debug grid.
    for (let i = 0; i < staticGroundMarks.length; i++) {
      const m = staticGroundMarks[i];
      if (Math.max(Math.abs(m.x-cx), Math.abs(m.z-cz)) > r + 4) continue;
      const p = proj(m.x, 0.02, m.z);
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(m.a); ctx.fillStyle = m.c; ctx.fillRect(-m.w*tileW/2, -m.h*tileH/2, m.w*tileW, m.h*tileH); ctx.restore();
    }
  }
  function ensureGroundMarks() {
    if (staticGroundMarks.length >= minGroundMarks) return;
    for (let i = staticGroundMarks.length; i < minGroundMarks; i++) {
      const x = Math.floor((stableRand(i,7,2)-0.5)*140);
      const z = Math.floor((stableRand(i,11,3)-0.5)*140);
      staticGroundMarks.push({ x: x + stableRand(i,1,4)-0.5, z: z + stableRand(i,2,5)-0.5, w: 0.14 + stableRand(i,3,6)*0.42, h: 0.06 + stableRand(i,4,7)*0.18, a: (stableRand(i,5,8)-0.5)*1.4, c: stableRand(i,6,9)>0.55 ? "rgba(193,174,119,0.075)" : "rgba(173,212,185,0.055)" });
    }
  }
  function drawBuilding(b: any) {
    const kind = String(b.kind || b.type || "building").toLowerCase();
    const progress = b.buildProgress == null ? 1 : Number(b.buildProgress) || 1;
    const recipe = recipeVisibleParts(buildingRecipeFor(kind, { color: cssHex(b.cl || b.color || "#d6604f"), plinth: "#8f7b53", name: b.nm || b.name, buildProgress: progress }), progress);
    const scale = kind === "worldwonder" ? 2.55 : (kind.includes("gate") || kind === "keep" || kind === "watchtower" ? 2.15 : 1.82);
    const ox = Number(b.x || 0), oz = Number(b.z || 0);
    drawShadow(ox, oz, 0.72 * scale, 0.34 * scale, lightForTime().shadow * 0.9);
    for (const part of recipe) drawRecipePart(ox, oz, part, scale);
    if (b.constructUntil && b.constructUntil > Date.now()) {
      const p = proj(ox, 2.2, oz);
      ctx.fillStyle = "rgba(255,215,110,0.88)"; ctx.font = `800 ${Math.max(11, 12*visualZoom())}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("building", p.x, p.y);
    }
  }
  function drawDoodad(d: any) {
    const kind = String(d.type || d.kind || "tree").toLowerCase();
    const scale = kind === "rock" ? 1.50 : kind === "food" ? 1.34 : 1.42;
    drawShadow(Number(d.x||0), Number(d.z||0), 0.52 * scale, 0.24 * scale, 0.16);
    for (const part of resourceRecipeFor(kind, 0)) drawResourcePart(Number(d.x||0), Number(d.z||0), part, scale);
  }
  function drawPlayerSprite(ply: any, isMe = false) {
    const x = Number(ply.x ?? 0), z = Number(ply.z ?? 0);
    drawShadow(x, z, isMe ? 0.44 : 0.34, isMe ? 0.23 : 0.18, isMe ? 0.22 : 0.16);
    const p = proj(x, 0, z);
    const sc = visualZoom() * (isMe ? 1.14 : 0.96);
    ctx.save(); ctx.translate(p.x, p.y - 24*sc); ctx.scale(sc, sc);
    const body = numColorToHex(ply.body || ply.color || 0x14f195, "#14f195");
    const hat = numColorToHex(ply.hat || 0x7dcfe8, "#7dcfe8");
    ctx.fillStyle = "#f4d7b5"; ctx.beginPath(); ctx.arc(0,-16,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(0,-20,9,Math.PI,Math.PI*2); ctx.fill(); ctx.fillRect(-9,-20,18,4);
    ctx.fillStyle = tint(body, 1.04, [1,1,1]) as string; ctx.beginPath(); ctx.roundRect(-8,-8,16,22,5); ctx.fill();
    ctx.fillStyle = "#f4d7b5"; ctx.fillRect(-13,-5,5,16); ctx.fillRect(8,-5,5,16);
    ctx.fillStyle = "#38251b"; ctx.fillRect(-6,14,5,5); ctx.fillRect(2,14,5,5);
    ctx.fillStyle = "#2b211d"; ctx.beginPath(); ctx.arc(-3,-16,1.2,0,Math.PI*2); ctx.arc(4,-16,1.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#7a4135"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(1,-13,3,0.15,Math.PI-0.15); ctx.stroke();
    ctx.restore();
  }
  function drawLoot(l: any) {
    const x = Number(l.x || 0), z = Number(l.z || 0);
    drawShadow(x, z, 0.20, 0.10, 0.14);
    drawPrismMin(x-0.12,z-0.12,0.02,0.24,0.24,0.12,"#ffd76e","#a77a22","#705018");
  }
  function drawOverlayCells() {
    for (const h of hintCells || []) {
      const color = numColorToHex(h.color, "#14f195");
      const a = proj(h.x - 0.5, 0.035, h.z), b = proj(h.x, 0.035, h.z - 0.5), c = proj(h.x + 0.5, 0.035, h.z), d = proj(h.x, 0.035, h.z + 0.5);
      poly([a,b,c,d], `${color}${Math.round(255 * Number(h.opacity || 0.2)).toString(16).padStart(2,"0")}`, "rgba(255,255,255,0.18)");
    }
    if (hoverMarker.visible) {
      const color = hoverMarker.material?.color?._hex || "#14f195";
      const x = hoverMarker.position.x, z = hoverMarker.position.z;
      const a = proj(x - 0.5, 0.045, z), b = proj(x, 0.045, z - 0.5), c = proj(x + 0.5, 0.045, z), d = proj(x, 0.045, z + 0.5);
      poly([a,b,c,d], `${color}28`, `${color}aa`);
    }
    if (ghost) {
      const color = ghost.valid ? "#ffd76e" : "#d6604f";
      const x = ghost.x, z = ghost.z;
      const a = proj(x - 0.55, 0.05, z), b = proj(x, 0.05, z - 0.55), c = proj(x + 0.55, 0.05, z), d = proj(x, 0.05, z + 0.55);
      poly([a,b,c,d], `${color}33`, `${color}cc`);
    }
  }
  function rebuildCells(force = false) {
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.round(me.x), cz = Math.round(me.z);
    if (!force && lastVisibleCenter.r === r && Math.max(Math.abs(cx-lastVisibleCenter.x), Math.abs(cz-lastVisibleCenter.z)) <= 6) return;
    cells.clear();
    // Procedural resources are viewport-local cache entries. They are regenerated
    // from the shared deterministic naturalDoodad() rule on each window rebuild.
    for (const [kk, d] of Array.from(doodads.entries())) if (d?.natural) doodads.delete(kk);
    lastVisibleCenter = { x: cx, z: cz, r };
    for (let x = cx-r; x <= cx+r; x++) for (let z = cz-r; z <= cz+r; z++) {
      if (Math.max(Math.abs(x-cx), Math.abs(z-cz)) > r) continue;
      const kk = kfn(x,z);
      cells.set(kk, { cx: x, cz: z, owner: tileOwner.get(kk)?.owner || 0 });
      if (!doodads.has(kk) && !buildAt.has(kk) && exceptions.get(kk) !== "gone") {
        const nd = normalizeDoodadKind(opts.naturalDoodad?.(x, z));
        if (nd) doodads.set(kk, { x, z, type: nd, kind: nd, natural: true });
      }
    }
  }
  function draw() {
    resize(); updateProjection(); ensureGroundMarks();
    const cx = Number(me.x || 0), cz = Number(me.z || 0);
    targetCameraX = width / 2 - (cx - cz) * tileW;
    targetCameraY = height * 0.55 - (cx + cz) * tileH;
    cameraX += (targetCameraX - cameraX) * 0.18;
    cameraY += (targetCameraY - cameraY) * 0.18;
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle = "#244735"; ctx.fillRect(0,0,width,height);
    const bg = ctx.createRadialGradient(width*0.45,height*0.35,0,width*0.50,height*0.50,Math.max(width,height)*0.74);
    bg.addColorStop(0,"rgba(74,119,86,0.26)"); bg.addColorStop(1,"rgba(5,12,18,0.30)"); ctx.fillStyle = bg; ctx.fillRect(0,0,width,height);
    drawTerrain(); drawOverlayCells();

    const ents: any[] = [];
    for (const b of buildPool.values()) ents.push({ kind:"building", x:Number(b.x||0)-1.0, z:Number(b.z||0)-1.0, y:0, h:Number(b.height||2.5), data:b });
    for (const d of doodads.values()) if (d && d.type !== "gone") ents.push({ kind:"doodad", x:Number(d.x||0)-0.8, z:Number(d.z||0)-0.8, y:0, h:1.6, data:d });
    for (const l of lootPool.values()) ents.push({ kind:"loot", x:Number(l.x||0), z:Number(l.z||0), y:0, h:0.4, data:l });
    for (const p of remotes) if (p && p.id !== me.id) ents.push({ kind:"remote", x:Number(p.x||0), z:Number(p.z||0), y:0, h:1.6, data:p });
    ents.push({ kind:"me", x:Number(me.x||0), z:Number(me.z||0), y:0, h:1.8, data:me });
    ents.sort((a,b) => ((a.x+a.z+a.h*0.18) - (b.x+b.z+b.h*0.18)));
    for (const e of ents) {
      if (e.kind === "building") drawBuilding(e.data);
      else if (e.kind === "doodad") drawDoodad(e.data);
      else if (e.kind === "loot") drawLoot(e.data);
      else if (e.kind === "remote") drawPlayerSprite(e.data, false);
      else if (e.kind === "me") drawPlayerSprite(me, true);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.life -= 0.018; f.y += 0.018;
      if (f.life <= 0) { floaters.splice(i,1); continue; }
      const p = proj(f.x, f.y, f.z); ctx.textAlign = "center"; ctx.font = `800 ${Math.max(12, 14*visualZoom())}px system-ui, sans-serif`; ctx.strokeStyle = `rgba(7,10,12,${f.life*0.6})`; ctx.lineWidth = 3; ctx.strokeText(f.text,p.x,p.y); ctx.fillStyle = f.color || "#ffd76e"; ctx.globalAlpha = Math.max(0, f.life); ctx.fillText(f.text,p.x,p.y); ctx.globalAlpha = 1;
    }
  }
  function normalizeDoodadKind(value: any) {
    const k = String(value?.type || value?.kind || value || "").toLowerCase();
    return k === "rock" || k === "tree" || k === "food" ? k : "";
  }
  function doodadAt(x: number, z: number, radius = 0.75, want?: string) {
    const tx = Math.trunc(Number(x)), tz = Math.trunc(Number(z));
    let best: any = null, bd = Infinity;
    const wantKind = normalizeDoodadKind(want);
    const scan = Math.max(0, Math.ceil(Number(radius || 0)));
    for (let dx = -scan; dx <= scan; dx++) for (let dz = -scan; dz <= scan; dz++) {
      const d = doodads.get(kfn(tx + dx, tz + dz));
      if (!d || d.type === "gone") continue;
      const kind = normalizeDoodadKind(d);
      if (wantKind && kind !== wantKind) continue;
      const dist = Math.max(Math.abs((tx + dx) - x), Math.abs((tz + dz) - z));
      if (dist <= radius && dist < bd) { best = d; bd = dist; }
    }
    return best;
  }
  function resolvedDoodad(d: any) {
    if (!d) return null;
    return { x: Math.trunc(Number(d.x)), z: Math.trunc(Number(d.z)), kind: normalizeDoodadKind(d) };
  }
  function resolveDoodadCell(x: number, z: number, want?: string) {
    // Resources are intentionally drawn larger than one server tile in the
    // canvas renderer. Pointer projection may land on a neighboring tile even
    // though the player clearly clicked the visual tree/rock. Resolve with a
    // generous visual radius, then return the authoritative server cell.
    return resolvedDoodad(doodadAt(x, z, 2.15, want));
  }
  function doodadFromEvent(ev: PointerEvent | MouseEvent, want?: string) {
    const w = eventWorld(ev);
    // Use the fractional pointer world coordinate here; rounding first is what
    // made large prism resources feel unclickable near their visible edges.
    return resolvedDoodad(doodadAt(w.wx, w.wz, 2.65, want));
  }
  function canIssueMoveNow() { return inFlight < maxInFlight; }
  function hasPendingMove() { return pendingPath.length > 0 || inFlight > 0; }

  function tick(now: number) {
    if (disposed) return;
    const dt = Math.min(50, now - lastFrame); lastFrame = now;
    if (me.walking) me.walkPhase += dt * 0.01;
    if (pendingPath.length && now - lastStepAt >= 158 && canIssueMoveNow()) {
      const next = pendingPath[0];
      if (next && stepTo(next.x, next.z)) pendingPath.shift();
      else pendingPath.length = 0;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }
  function blocked(x: number, z: number) {
    const kk = kfn(x,z);
    if (buildAt.has(kk)) return true;
    const d = doodads.get(kk); if (d && d.type !== "gone") return true;
    return false;
  }
  function nearestOpenNeighbor(tx: number, tz: number) {
    let best: any = null, bd = Infinity;
    for (const [dx,dz] of n8) {
      const x = tx + dx, z = tz + dz;
      if (blocked(x,z)) continue;
      const d = cheb(x,z,me.x,me.z);
      if (d < bd) { bd = d; best = { x,z }; }
    }
    return best;
  }
  function computePath(tx: number, tz: number, near = false) {
    const target = near ? nearestOpenNeighbor(tx,tz) : { x: tx, z: tz };
    if (!target || blocked(target.x,target.z)) return [];
    const start = kfn(me.x,me.z), goal = kfn(target.x,target.z);
    const prev = new Map([[start, null as any]]); const q = [{ x: me.x, z: me.z }];
    while (q.length && prev.size < 2400) {
      const cur = q.shift()!;
      if (kfn(cur.x,cur.z) === goal) break;
      for (const [dx,dz] of n8) {
        const nx = cur.x + dx, nz = cur.z + dz, kk = kfn(nx,nz);
        if (prev.has(kk) || blocked(nx,nz)) continue;
        if (cheb(nx,nz,me.x,me.z) > 90) continue;
        prev.set(kk, cur); q.push({ x:nx, z:nz });
      }
    }
    if (!prev.has(goal)) return [];
    const out:any[] = []; let cur:any = target;
    while (cur && kfn(cur.x,cur.z) !== start) { out.push({x:cur.x,z:cur.z}); cur = prev.get(kfn(cur.x,cur.z)); }
    return out.reverse();
  }
  function sendMove(x: number, z: number) {
    if (!opts.sendAction || !canIssueMoveNow()) return false;
    const seq = ++moveSeq; inFlight++;
    opts.sendAction("movePath", { baseSeq: ackSeq, moveSeq: seq, steps: [{ x, z, seq }] }).then((r:any) => {
      inFlight = Math.max(0, inFlight - 1);
      if (!r || !r.ok) {
        opts.onError?.();
        const rx = Number(r?.x), rz = Number(r?.z);
        // The Three renderer used authoritative mesh/raycast state, so a
        // rejected move naturally corrected on the next scene update. Canvas is
        // fully local between polls; roll back immediately to the last known
        // server position if the rejection did not include coordinates.
        hardSnapMe(Number.isFinite(rx) ? rx : lastAuthoritative.x, Number.isFinite(rz) ? rz : lastAuthoritative.z);
        opts.pollSoon?.();
        return;
      }
      ackSeq = Math.max(ackSeq, Number(r.ackSeq || r.acceptedSeq || seq) || seq);
      const serverX = Number(r.x ?? (Array.isArray(r.path) && r.path.length ? r.path[r.path.length - 1]?.x : NaN));
      const serverZ = Number(r.z ?? (Array.isArray(r.path) && r.path.length ? r.path[r.path.length - 1]?.z : NaN));
      if (Number.isFinite(serverX) && Number.isFinite(serverZ)) lastAuthoritative = { x: Math.trunc(serverX), z: Math.trunc(serverZ) };
      if (!pendingPath.length && inFlight === 0 && Number.isFinite(serverX) && Number.isFinite(serverZ)) {
        const drift = Math.max(Math.abs(Math.trunc(serverX) - me.x), Math.abs(Math.trunc(serverZ) - me.z));
        if (drift > 1) hardSnapMe(serverX, serverZ);
      }
    }).catch(() => { inFlight = Math.max(0, inFlight - 1); hardSnapMe(lastAuthoritative.x, lastAuthoritative.z); });
    return true;
  }
  function stepTo(x: number, z: number) {
    x = Math.trunc(Number(x)); z = Math.trunc(Number(z));
    if (!canIssueMoveNow()) return false;
    if (blocked(x,z)) return false;
    me.facingX = x - me.x; me.facingZ = z - me.z; me.walking = true; lastStepAt = performance.now();
    me.x = x; me.z = z;
    if (ST.me) { ST.me.x = x; ST.me.z = z; }
    opts.onHop?.();
    if (!sendMove(x,z)) return false;
    rebuildCells();
    setTimeout(() => { if (!pendingPath.length) me.walking = false; }, 140);
    return true;
  }
  function applyWorld(w: any = {}) {
    tileOwner.clear(); buildAt.clear(); buildPool.clear(); lootPool.clear(); doodads.clear(); tradePostPool.clear();
    for (const t of w.tiles || []) tileOwner.set(kfn(t.x,t.z), { owner:t.owner, body:t.ownerBody, name:t.ownerName });
    for (const d of w.doodads || []) { if (!d) continue; const kk=kfn(d.x,d.z); if (exceptions.get(kk)==="gone") continue; doodads.set(kk, { ...d, x:Math.trunc(Number(d.x)), z:Math.trunc(Number(d.z)) }); }
    const worldBuildings = Array.isArray(w.buildings) ? w.buildings : [];
    let virtualCapital:any[] = [];
    try { virtualCapital = opts.capitalBuildingsInView?.(Number(w.ax || ST.ax || 0), Number(w.az || ST.az || 0), (opts.currentTileLoadRadius?.() || 36) + 12) || []; } catch {}
    const blockedCapital = new Set(worldBuildings.map((b:any) => kfn(b.x,b.z)));
    const renderBuildings = worldBuildings.concat(virtualCapital.filter((b:any)=>!blockedCapital.has(kfn(b.x,b.z))));
    for (const b of renderBuildings) {
      const uid = b.uid ?? `${b.kind || b.type}:${b.x},${b.z}`;
      const row = { ...b, uid, x:Math.trunc(Number(b.x||0)), z:Math.trunc(Number(b.z||0)), kind:String(b.kind || b.type || "building") };
      buildPool.set(uid,row); buildAt.set(kfn(row.x,row.z), row);
    }
    for (const l of w.loot || []) { const id = l.id ?? `${l.x},${l.z},${l.g || 0}`; lootPool.set(id, { ...l, id }); }
    rebuildCells(true);
  }
  function applyMe(p: any) {
    const src = p || ST.me || {};
    me.id = src.id ?? me.id; me.name = src.name || me.name; me.body = src.body ?? me.body; me.hat = src.hat ?? me.hat;
    const sx = Number(src.x), sz = Number(src.z);
    if (Number.isFinite(sx) && Number.isFinite(sz)) {
      const tx = Math.trunc(sx), tz = Math.trunc(sz);
      // Server snapshots can arrive behind the local optimistic canvas walk.
      // Do not yank the player back unless the drift is clearly impossible.
      lastAuthoritative = { x: tx, z: tz };
      if (!hasPendingMove() || Math.max(Math.abs(tx - me.x), Math.abs(tz - me.z)) > 8) {
        me.x = tx; me.z = tz;
      }
    }
    rebuildCells();
  }
  function applyPlayers(players: any[] = []) {
    remotes.length = 0; playersById.clear();
    for (const p of players || []) { if (!p) continue; playersById.set(p.id,p); if (p.id !== me.id) remotes.push(p); }
  }
  function eventWorld(ev: PointerEvent | MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = (ev.clientX ?? 0) - rect.left;
    const sy = (ev.clientY ?? 0) - rect.top;
    const w = screenToWorld(sx, sy);
    return { ...w, sx, sy };
  }
  function cellFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    return { x: Math.round(w.wx), z: Math.round(w.wz) };
  }
  function buildingVisualRadius(kind: any) {
    const k = String(kind || "building").toLowerCase();
    if (k === "worldwonder") return 5.75;
    if (k === "keep" || k.includes("gate") || k === "watchtower") return 3.55;
    if (k === "warehouse" || k === "townhall" || k === "academy" || k === "bank" || k === "vault") return 3.05;
    return 2.55;
  }
  function buildingFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    const c = { x: Math.round(w.wx), z: Math.round(w.wz) };
    const exact = buildAt.get(kfn(c.x,c.z));
    if (exact) return { uid: exact.uid, b: exact };

    // Canvas buildings are intentionally much bigger than the authoritative
    // one-cell server anchor. The old Three raycast hit the mesh itself; after
    // the canvas rewrite we need a visual hit test or clicks on roofs/caps land
    // on nearby terrain cells and tools/inspect feel broken.
    let best:any = null, bestScore = Infinity;
    for (const b of buildPool.values()) {
      const bx = Number(b.x || 0), bz = Number(b.z || 0);
      const r = buildingVisualRadius(b.kind);
      const dx = Math.abs(w.wx - bx), dz = Math.abs(w.wz - bz);
      if (Math.max(dx, dz) > r) continue;
      const base = proj(bx, 0, bz);
      const screenScore = Math.hypot(w.sx - base.x, w.sy - (base.y - r * heightScale * 0.34)) / Math.max(1, tileW);
      const worldScore = Math.max(dx, dz) * 0.45;
      const depthBias = -(bx + bz) * 0.001;
      const score = screenScore + worldScore + depthBias;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best ? { uid: best.uid, b: best } : null;
  }
  function buildPoolAt(x:number,z:number) { return buildAt.get(kfn(x,z)); }
  function doodadVisible(x:number,z:number) {
    const d = doodadAt(Number(x), Number(z), 1.35);
    return d ? normalizeDoodadKind(d) || true : false;
  }
  function refreshWindow(force = false) { rebuildCells(!!force); }
  function pathTo(x:number,z:number) { const p = computePath(Math.trunc(x),Math.trunc(z),false); if (!p.length) return false; pendingPath = p; return true; }
  function pathToNear(x:number,z:number) { const p = computePath(Math.trunc(x),Math.trunc(z),true); if (!p.length) return false; pendingPath = p; return true; }
  function canIssueMove() { return canIssueMoveNow(); }
  function tryMoveDelta(dx:number,dz:number) { if (!canIssueMoveNow()) return false; pendingPath.length = 0; return stepTo(me.x + Math.trunc(dx), me.z + Math.trunc(dz)); }
  function hardSnapMe(x:number,z:number) { me.x=Math.trunc(Number(x)); me.z=Math.trunc(Number(z)); if (ST.me) { ST.me.x=me.x; ST.me.z=me.z; } pendingPath.length=0; rebuildCells(true); }
  function setFacing(x:number,z:number) { me.facingX=x; me.facingZ=z; }
  function setWalking(v:boolean) { me.walking=!!v; }
  function setHintCells(c:any[]) { hintCells = Array.isArray(c) ? c.slice(0, 512) : []; }
  function showBuildGhost(x:number,z:number,valid=true) { ghost = { x,z,valid }; }
  function hideBuildGhost() { ghost = null; }
  function floatText(x:number,z:number,text:string,color="#ffd76e") { floaters.push({x,z,y:1.2,text,color,life:1}); }
  function burst(x:number,y:number,z:number,color=0xffd76e,count=8) { floatText(x,z,"✦",numColorToHex(color,"#ffd76e")); }
  function shockwave(x:number,z:number,color=0xffd76e) { floatText(x,z,"◎",numColorToHex(color,"#ffd76e")); }
  function markDoodadGone(x:number,z:number) { const kk=kfn(x,z); exceptions.set(kk,"gone"); doodads.delete(kk); }
  function removeBuild(uid:any) { const b=buildPool.get(uid); if (!b) return; buildPool.delete(uid); buildAt.delete(kfn(b.x,b.z)); }
  function minimapSnapshot() {
    return {
      tiles: Array.from(cells.values()).map((c:any) => ({ x: c.cx ?? c.x, z: c.cz ?? c.z, owner: c.owner || 0, ownerBody: tileOwner.get(kfn(c.cx ?? c.x, c.cz ?? c.z))?.body })),
      buildings: Array.from(buildPool.values()).map((b:any) => ({ x: b.x, z: b.z, kind: b.kind, owner: b.owner, uid: b.uid })),
      loot: Array.from(lootPool.values()).map((l:any) => ({ x: l.x, z: l.z, kind: l.kind, id: l.id })),
      players: [me, ...remotes].map((p:any) => ({ id: p.id, x: p.x, z: p.z, body: p.body, name: p.name, lastSeen: Date.now() })),
    };
  }
  function pickFromEvent(ev: PointerEvent | MouseEvent) {
    const building = buildingFromEvent(ev);
    const doodad = doodadFromEvent(ev);
    const raw = cellFromEvent(ev);
    const cell = building?.b ? { x: building.b.x, z: building.b.z } : doodad ? { x: doodad.x, z: doodad.z } : raw;
    return { cell, building, doodad, raw };
  }
  function worldToScreen(x:number, z:number, y = 0) { return proj(Number(x), Number(y), Number(z)); }
  function screenToWorldPoint(sx:number, sy:number) { return screenToWorld(Number(sx), Number(sy)); }
  function visibleCells() { return Array.from(cells.values()).map((c:any) => ({ x: c.cx ?? c.x, z: c.cz ?? c.z, owner: c.owner || 0 })); }
  function updateMinimapInfo() { /* world map/minimap UI is still handled by existing canvas map code. */ }
  function dispose() { disposed = true; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); try { canvas.remove(); } catch {} }

  window.addEventListener("resize", resize);
  resize(); updateProjection(); applyMe(ST.me); rebuildCells(true); raf = requestAnimationFrame(tick);

  return {
    applyWorld, applyPlayers, applyMe, me, cellFromEvent, buildingFromEvent, pickFromEvent, worldToScreen, screenToWorldPoint, visibleCells, pathTo, pathToNear, tryMoveDelta,
    blocked, buildPoolAt, doodadVisible, doodadAt, resolveDoodadCell, doodadFromEvent, burst, floatText, shockwave, hoverMarker, hardSnapMe, markDoodadGone, removeBuild,
    setHintCells, hideBuildGhost, showBuildGhost, refreshWindow, rebuildBuilding: (uid:any) => {}, animateBuildingUse: (uid:any) => { const b=buildPool.get(uid); if (b) floatText(b.x,b.z,"used","#ffd76e"); }, refreshConstructionProgress: () => {},
    refreshOwnRig: () => {}, applyVisualQuality: () => {}, hasPendingMove, canIssueMove, minimapSnapshot,
    tileOwner, buildPool, buildAt, lootPool, rigPool, tradePostPool, cells, updateMinimapInfo,
    rotateCam: () => {}, refreshCameraRotation: () => {}, refreshCameraZoom: () => { updateProjection(); rebuildCells(true); }, refreshEnvironment: () => {},
    zoom: (delta = 0) => { zoomValue = clamp(zoomValue + Number(delta || 0), 0.72, 1.55); updateProjection(); },
    walkQueueClear: () => { pendingPath.length = 0; }, dispose, setFacing, setWalking,
  };
}
