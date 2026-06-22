// @ts-nocheck
import * as THREE from "three";
import { duskHex, duskNumber } from "./theme/duskIndustrialPalette";

const DEFAULT_ATLAS: Record<string, string> = {
  terrain: "/api/atlas-runtime/terrain",
  building: "/api/atlas-runtime/building",
  fx: "/api/atlas-runtime/fx",
  ui: "/api/atlas-runtime/ui",
  doll: "/api/atlas-runtime/doll",
  tool: "/api/atlas-runtime/tool",
  cursor: "/api/atlas-runtime/cursor",
};

// Stage 31: art atlases are being regenerated. Keep the live game on the
// procedural/canvas fallback path until the new atlas contract is published.
const FORCE_PROCEDURAL_TERRAIN = true;
const FORCE_FALLBACK_ATLASES = true;

let ATLAS: Record<string, string> = { ...DEFAULT_ATLAS };
let ATLAS_BOUNDS: Record<string, any> = {
  terrain: { x0: 0, y0: 0, x1: 1024, y1: 1024 },
  building: { x0: 0, y0: 0, x1: 1024, y1: 1024 },
  fx: { x0: 0, y0: 0, x1: 1024, y1: 1024 },
  ui: { x0: 0, y0: 0, x1: 1024, y1: 1024 },
  doll: { x0: 0, y0: 0, x1: 1024, y1: 1024 },
  tool: { x0: 0, y0: 0, x1: 1024, y1: 614 },
  cursor: { x0: 0, y0: 0, x1: 1024, y1: 341 },
};
let ATLAS_CELLS: Record<string, number> = { terrain: 4, building: 4, fx: 4, ui: 4, doll: 8, tool: 5, cursor: 6 };
let ATLAS_COLS: Record<string, number> = { terrain: 4, building: 4, fx: 4, ui: 4, doll: 8, tool: 5, cursor: 6 };
let ATLAS_ROWS: Record<string, number> = { terrain: 4, building: 4, fx: 4, ui: 4, doll: 6, tool: 3, cursor: 2 };
let ATLAS_PAD: Record<string, number> = { terrain: 0, building: 0, fx: 0, ui: 0, doll: 0, tool: 0, cursor: 0 };
let ATLAS_MODE: Record<string, string> = { terrain: "procedural", building: "procedural", fx: "procedural", ui: "procedural", doll: "procedural", tool: "procedural", cursor: "procedural" };
let runtimeSig = "boot";

const texCache = new Map<string, THREE.Texture>();
const matCache = new Map<string, THREE.Material>();
const animatedMaps: THREE.Texture[] = [];
let TERRAIN_PREFS = { warmth: 0.72, texture: 0.08 };
export function setTerrainVisualPrefs(v: any = {}) {
  TERRAIN_PREFS = {
    warmth: Math.max(0, Math.min(1, Number(v.warmth ?? TERRAIN_PREFS.warmth))),
    texture: Math.max(0, Math.min(1, Number(v.texture ?? TERRAIN_PREFS.texture))),
  };
  clearCaches();
}
function mixHex(a: string, b: string, t: number) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return `#${ca.lerp(cb, Math.max(0, Math.min(1, t))).getHexString()}`;
}

export const MATERIAL_SLOT: Record<string, [number, number]> = {
  wood: [0, 0], darkwood: [1, 0], stone: [2, 0], marble: [3, 0],
  cobble: [0, 1], plaster: [1, 1], roof: [2, 1], slate: [3, 1],
  thatch: [0, 2], cloth: [1, 2], purplecloth: [2, 2], canvas: [3, 2],
  metal: [0, 3], rune: [1, 3], banner: [2, 3], carved: [3, 3],
};

function clearCaches() {
  texCache.forEach((t) => t.dispose?.());
  matCache.forEach((m) => m.dispose?.());
  texCache.clear();
  matCache.clear();
  animatedMaps.length = 0;
}

export function atlasMode(kind: string) {
  if (kind === "terrain" && FORCE_PROCEDURAL_TERRAIN) return "procedural";
  if (FORCE_FALLBACK_ATLASES) return "procedural";
  return ATLAS_MODE[kind] || (kind === "terrain" ? "procedural" : "atlas");
}

export async function loadAtlasRuntimeConfig(force = false) {
  if (!force && runtimeSig !== "boot") return { ok: true };
  try {
    const res = await fetch("/api/atlas-runtime", { cache: "no-store" });
    const json = await res.json();
    const atlases = json.atlases || json.runtime || {};
    for (const [id, cfg] of Object.entries<any>(atlases)) {
      if (cfg?.url) ATLAS[id] = cfg.url;
      if (cfg?.bounds) ATLAS_BOUNDS[id] = cfg.bounds;
      if (cfg?.cells) ATLAS_CELLS[id] = Number(cfg.cells) || ATLAS_CELLS[id] || 4;
      if (cfg?.cols || cfg?.cells) ATLAS_COLS[id] = Number(cfg.cols || cfg.cells) || ATLAS_COLS[id] || 4;
      if (cfg?.rows || cfg?.cells) ATLAS_ROWS[id] = Number(cfg.rows || cfg.cells) || ATLAS_ROWS[id] || 4;
      ATLAS_PAD[id] = Number(cfg?.pad || cfg?.inset || 0) || 0;
      if (cfg?.mode) ATLAS_MODE[id] = cfg.mode;
    }
    Object.assign(ATLAS_MODE, json.modesByAtlas || {});
    if (FORCE_PROCEDURAL_TERRAIN) ATLAS_MODE.terrain = "procedural";
    if (FORCE_FALLBACK_ATLASES) {
      for (const id of Object.keys(ATLAS_MODE)) ATLAS_MODE[id] = "procedural";
    }
    runtimeSig = String(json.generatedAt || Date.now());
    clearCaches();
    return json;
  } catch (e) {
    runtimeSig = "fallback";
    return { ok: false, msg: String((e as any)?.message || e) };
  }
}

function makeCanvasTexture(key: string, size: number, draw: Function, repeat = 1) {
  const k = `canvas:${key}:${repeat}:${runtimeSig}`;
  const cached = texCache.get(k);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  draw(cv.getContext("2d")!, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  texCache.set(k, tex);
  return tex;
}

function fallbackDraw(kind: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const color =
      kind === "wood" || kind === "darkwood" ? "#8a5a2e" :
      kind === "roof" || kind === "thatch" ? "#9b4f38" :
      kind === "stone" || kind === "cobble" || kind === "marble" || kind === "slate" ? "#8c8a83" :
      kind === "metal" ? "#6f7b86" :
      kind === "rune" || kind === "purplecloth" ? "#6b4ed8" :
      "#c9b38a";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#000";
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * h / 12);
      ctx.lineTo(w, i * h / 12 + (i % 2 ? 6 : -4));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
}

function atlasCellTexture(atlas: string, name: string, slot: [number, number], repeat = 1) {
  const src = ATLAS[atlas] || DEFAULT_ATLAS[atlas];
  const b = ATLAS_BOUNDS[atlas] || { x0: 0, y0: 0, x1: 1024, y1: 1024 };
  const cells = ATLAS_CELLS[atlas] || 4;
  const cols = ATLAS_COLS[atlas] || cells || 4;
  const rows = ATLAS_ROWS[atlas] || cells || 4;
  const pad = ATLAS_PAD[atlas] || 0;
  const key = `atlas:${runtimeSig}:${atlas}:${src}:${name}:${slot.join(",")}:${repeat}`;
  const cached = texCache.get(key);
  if (cached) return cached;

  const tex = new THREE.Texture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  texCache.set(key, tex);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const cw = Math.max(1, (b.x1 - b.x0) / cols);
    const ch = Math.max(1, (b.y1 - b.y0) / rows);
    const sx = Math.round(b.x0 + slot[0] * cw + pad);
    const sy = Math.round(b.y0 + slot[1] * ch + pad);
    const sw = Math.max(1, Math.round(cw - pad * 2));
    const sh = Math.max(1, Math.round(ch - pad * 2));
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const ctx = cv.getContext("2d")!;
    try { ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256); }
    catch { fallbackDraw(name)(ctx, 256, 256); }
    tex.image = cv;
    if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  };
  img.onerror = () => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    fallbackDraw(name)(cv.getContext("2d")!, 256, 256);
    tex.image = cv;
    tex.needsUpdate = true;
  };
  img.src = src;
  return tex;
}


export const TERRAIN_SLOT: Record<string, [number, number]> = {
  grass: [0, 0], forest: [1, 0], dirt: [2, 0], path: [3, 0],
  sand: [0, 1], cobble: [1, 1], rocky: [2, 1], soil: [3, 1],
  farm: [0, 2], water: [1, 2], moss: [2, 2], deck: [3, 2],
  claimed: [0, 3], mint: [1, 3], purple: [2, 3], plain: [3, 3],
};

const TERRAIN_PALETTES: Record<string, { a: string; b: string; speck: string; line?: string }> = {
  // Dusk Industrial palette: smooth procedural texture, constrained colors.
  grass: { a: duskHex("brownBlack"), b: duskHex("warmBrown"), speck: duskHex("oliveStone") },
  forest: { a: duskHex("darkUmber"), b: duskHex("brownBlack"), speck: duskHex("oliveStone") },
  water: { a: duskHex("slateDeep"), b: duskHex("slate"), speck: duskHex("blueGray"), line: duskHex("blueGray") },
  sand: { a: duskHex("warmBrown"), b: duskHex("oliveStone"), speck: duskHex("darkUmber") },
  rocky: { a: duskHex("slate"), b: duskHex("slateLight"), speck: duskHex("slateDeep") },
  cobble: { a: duskHex("slate"), b: duskHex("slateLight"), speck: duskHex("slateDeep"), line: duskHex("slateDeep") },
  soil: { a: duskHex("darkUmber"), b: duskHex("copper"), speck: duskHex("ink") },
  dirt: { a: duskHex("darkUmber"), b: duskHex("copper"), speck: duskHex("ink") },
  farm: { a: duskHex("warmBrown"), b: duskHex("brass"), speck: duskHex("darkUmber"), line: duskHex("bone") },
  moss: { a: duskHex("brownBlack"), b: duskHex("oliveStone"), speck: duskHex("darkUmber") },
  deck: { a: duskHex("darkUmber"), b: duskHex("copper"), speck: duskHex("ink"), line: duskHex("rustDark") },
  claimed: { a: duskHex("deepOxblood"), b: duskHex("warmBrown"), speck: duskHex("slateDeep") },
  plain: { a: duskHex("brownBlack"), b: duskHex("warmBrown"), speck: duskHex("oliveStone") },
};

function smooth01(n: number) { return n * n * (3 - 2 * n); }
function hash2(x: number, y: number, seed = 0) {
  let h = ((x * 374761393) ^ (y * 668265263) ^ (seed * 1442695041)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x: number, y: number, scale: number, seed = 0) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const tx = smooth01((x / scale) - gx), ty = smooth01((y / scale) - gy);
  const a = hash2(gx, gy, seed), b = hash2(gx + 1, gy, seed), c = hash2(gx, gy + 1, seed), d = hash2(gx + 1, gy + 1, seed);
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * ty;
}
function fbm(x: number, y: number, seed = 0) {
  return valueNoise(x, y, 32, seed) * 0.66 + valueNoise(x, y, 12, seed + 17) * 0.34;
}

function terrainFallbackDraw(kind: string, tint?: number) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const p = TERRAIN_PALETTES[kind] || TERRAIN_PALETTES.sand;
    const warmA = mixHex(p.a, duskHex("oliveStone"), TERRAIN_PREFS.warmth * 0.10);
    const warmB = mixHex(p.b, duskHex("copper"), TERRAIN_PREFS.warmth * 0.08);
    const detail = TERRAIN_PREFS.texture;
    const img = ctx.createImageData(w, h);
    const a = new THREE.Color(warmA), b = new THREE.Color(warmB);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm(x, y, kind.length * 19);
        const t = Math.max(0, Math.min(1, 0.32 + n * 0.52 + (x + y) / (w + h) * 0.10));
        const c = a.clone().lerp(b, t);
        const shade = 1.08 + (n - 0.5) * detail * 0.12;
        const i = (y * w + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, Math.round(c.r * 255 * shade)));
        img.data[i + 1] = Math.max(0, Math.min(255, Math.round(c.g * 255 * shade)));
        img.data[i + 2] = Math.max(0, Math.min(255, Math.round(c.b * 255 * shade)));
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.015 + detail * 0.030;
    ctx.fillStyle = p.speck;
    for (let i = 0; i < 34; i++) {
      const x = hash2(i, kind.length, 5) * w, y = hash2(i, kind.length, 9) * h;
      const r = 0.8 + hash2(i, 8, 13) * 2.2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (kind === "water") {
      ctx.globalAlpha = 0.15 + detail * 0.18;
      ctx.strokeStyle = p.line || "#d5fbff"; ctx.lineWidth = 2;
      for (let y = 18; y < h; y += 30) { ctx.beginPath(); for (let x = 0; x <= w; x += 16) { const yy = y + Math.sin(x / 22) * 3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    } else if (kind === "farm") {
      ctx.globalAlpha = 0.18 + detail * 0.12; ctx.strokeStyle = p.line || "#fff1b3"; ctx.lineWidth = 3;
      for (let y = 12; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + 8); ctx.stroke(); }
    } else if (kind === "cobble" || kind === "rocky") {
      ctx.globalAlpha = 0.10 + detail * 0.14; ctx.strokeStyle = p.line || "#5e5b55"; ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 10, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + 8); ctx.stroke(); }
    } else if (kind === "forest") {
      ctx.globalAlpha = 0.11 + detail * 0.12; ctx.fillStyle = duskHex("oliveStone");
      for (let i = 0; i < 45; i++) { const x = hash2(i, 3, 4) * w, y = hash2(i, 5, 6) * h; ctx.fillRect(x, y, 5 + hash2(i, 7, 8) * 10, 2); }
    }
    if (kind === "claimed" && tint != null) {
      const owner = new THREE.Color(tint >>> 0);
      ctx.globalAlpha = 0.22 + detail * 0.05;
      ctx.fillStyle = `#${owner.getHexString()}`;
      ctx.fillRect(0, 0, w, h);
      // Soft center mark only; no busy chevrons or heavy tile-border pattern.
      ctx.globalAlpha = 0.07 + detail * 0.05;
      ctx.strokeStyle = duskHex("bone");
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.44, h * 0.50); ctx.lineTo(w * 0.50, h * 0.44); ctx.lineTo(w * 0.56, h * 0.50); ctx.lineTo(w * 0.50, h * 0.56); ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
}

export function terrainTexture(kind = "sand", repeat = 1, tint?: number) {
  const k = TERRAIN_SLOT[kind] ? kind : "sand";
  if (atlasMode("terrain") === "atlas") return atlasCellTexture("terrain", k, TERRAIN_SLOT[k], repeat);
  const tex = makeCanvasTexture(`terrain:${k}:${tint ?? "none"}`, 256, terrainFallbackDraw(k, tint), repeat);
  if (k === "water" && !animatedMaps.includes(tex)) animatedMaps.push(tex);
  return tex;
}

export function terrainMaterial(kind = "sand", color?: number, opts: any = {}) {
  const k = TERRAIN_SLOT[kind] ? kind : "sand";
  const tint = k === "claimed" ? color : undefined;
  const key = `terrainMat:${runtimeSig}:${k}:${tint ?? "none"}:${JSON.stringify(opts || {})}`;
  const cached = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({
    color: k === "claimed" && color != null ? color : duskNumber(k === "water" ? "slateLight" : "bone"),
    map: terrainTexture(k, Number(opts?.repeat || 1) || 1, tint),
    roughness: k === "water" ? 0.68 : 0.94,
    metalness: 0,
    ...opts,
  });
  matCache.set(key, mat);
  return mat;
}

export function terrainMats(kind = "sand", ownerColor?: number) {
  const k = kind === "claimed" ? "claimed" : (TERRAIN_SLOT[kind] ? kind : "sand");
  const tint = k === "claimed" ? (ownerColor ?? 0x14f195) : undefined;
  const sideColor = k === "claimed" ? (ownerColor ?? 0x985d23) : (k === "water" ? 0x5d6a7e : k === "rocky" ? 0x82979e : 0x8c8565);
  const key = `terrainSides:${runtimeSig}:${k}:${tint ?? "none"}`;
  const cached = matCache.get(key) as THREE.Material[] | undefined;
  if (cached) return cached;
  const side = cachedStandardMaterial(sideColor, { roughness: 1 });
  const top = terrainMaterial(k, tint, { repeat: 1 });
  const arr = [side, side, top, side, side, side];
  matCache.set(key, arr as any);
  return arr;
}

export function materialTexture(kind: string, repeat = 1) {
  const k = MATERIAL_SLOT[kind] ? kind : "plaster";
  if (atlasMode("building") !== "atlas") return makeCanvasTexture(`building:${k}`, 256, fallbackDraw(k), repeat);
  return atlasCellTexture("building", k, MATERIAL_SLOT[k], repeat);
}

export function cachedStandardMaterial(color: number, opts: any = {}) {
  const key = `std:${runtimeSig}:${color}:${JSON.stringify(opts || {})}`;
  const cached = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });
  matCache.set(key, mat);
  return mat;
}

export function texturedMaterial(kind: string, color = 0xffffff, opts: any = {}) {
  const repeat = Number(opts?.repeat || 1) || 1;
  const key = `texmat:${runtimeSig}:${kind}:${color}:${JSON.stringify(opts || {})}`;
  const cached = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (cached) return cached;
  const extra = { ...opts };
  delete extra.repeat;
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: materialTexture(kind, repeat),
    roughness: 0.82,
    metalness: kind === "metal" ? 0.25 : 0,
    ...extra,
  });
  matCache.set(key, mat);
  return mat;
}

export function makeBlobShadow(radius = 0.48, opacity = 0.18, y = 0.012) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

export function makeSprite(name: string, scale = 0.38, opacity = 1) {
  const map = makeCanvasTexture(`sprite:${name}`, 128, fallbackDraw(name), 1);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity, depthWrite: false }));
  sp.scale.set(scale, scale, 1);
  return sp;
}

export function tickVisualTextures(t: number) {
  for (const tex of animatedMaps) {
    tex.offset.x = (t * 0.002) % 1;
    tex.offset.y = (t * 0.0012) % 1;
  }
}

export function refreshRuntimeAtlasTextures() { clearCaches(); }
export function getRuntimeAtlasUrl(kind: string) { return ATLAS[kind] || DEFAULT_ATLAS[kind] || ""; }
export function getRuntimeAtlasBounds(kind: string) { return ATLAS_BOUNDS[kind] || { x0: 0, y0: 0, x1: 1024, y1: 1024 }; }
export function getRuntimeAtlasPad(kind: string) { return ATLAS_PAD[kind] || 0; }
export function getRuntimeAtlasCells(kind: string) { return ATLAS_CELLS[kind] || (kind === "doll" ? 8 : 4); }
export function getRuntimeAtlasCols(kind: string) { return ATLAS_COLS[kind] || getRuntimeAtlasCells(kind); }
export function getRuntimeAtlasRows(kind: string) { return ATLAS_ROWS[kind] || getRuntimeAtlasCells(kind); }