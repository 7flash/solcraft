/* ============================================================
   WORLD OF SOLCRAFTS Doll atlas compositor.

   The Doll atlas is a PARTS sheet, not a finished character sheet.

   Expected Doll atlas layout, v3:
   8 columns x 6 rows. Recommended image/crop: 1024x768 with 128x128 cells.
   Runtime uses every row in this crop; there are no reserved/concept rows.
   row 0: head0..head7   (complete readable heads/faces; humans + aliens)
   row 1: hair0..hair7   (optional hair overlays; no hats)
   row 2: torso0..torso7
   row 3: legs0..legs7
   row 4: back0..back7
   row 5: tool0..tool7

   No skin-overlay row and no hat row. Heads already include face/skin/alien
   information so the atlas cannot accidentally cover the face with another
   layer. Older saved fields (skin/face/hat) are normalized for compatibility.
   ============================================================ */
// @ts-nocheck
import * as THREE from "three";

function envFlag(name: string, fallback: boolean) {
  const value = String((typeof process !== "undefined" ? (process as any)?.env?.[name] : "") ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}
const FORCE_FALLBACK_DOLL_ATLAS = envFlag("NEXT_PUBLIC_SOLCRAFT_FORCE_FALLBACK_ATLASES", true) || envFlag("NEXT_PUBLIC_SOLCRAFT_FORCE_PROCEDURAL_DOLLS", false);

export type DollEquip = {
  hand?: string;
  cape?: string;
  head?: string;
  body?: string;
  legs?: string;
  back?: string;
  tool?: string;
  mainhand?: string;
};

export type DollHeldTool =
  | "none"
  | "axe"
  | "pickaxe"
  | "staff"
  | "sword"
  | "hammer"
  | "shovel"
  | "spear"
  | "sickle";

export type DollPalette = {
  skin?: string;
  hair?: string;
  primaryCloth?: string;
  secondaryCloth?: string;
  leather?: string;
  metal?: string;
};

export type DollParts = {
  /** v2 head row. Older saves may still call this skin/face; normalizeDollParts maps them. */
  head: number;
  hair: number;
  torso: number;
  legs: number;
  back: number;
  tool: number;
  showBack?: boolean;
  showTool?: boolean;
  // Deprecated compatibility fields. Do not draw these as separate layers.
  skin?: number;
  face?: number;
  hat?: number;
  showHat?: boolean;
};

export type DollConfig = {
  name?: string;
  body?: number;
  hat?: number;
  equip?: DollEquip;
  lit?: boolean;
  seed?: number;
  dollParts?: Partial<DollParts>;
  palette?: DollPalette;
  heldTool?: DollHeldTool;
  /** Explicit opt-in for old localStorage-only preview callers.
      Live players pass their saved character profile directly so remote players
      never inherit this browser's local character. */
  useSavedParts?: boolean;
};

type Bounds = { x0: number; y0: number; x1: number; y1: number };
type RuntimeDoll = {
  url: string;
  bounds: Bounds;
  pad: number;
  cells: number;
  cols: number;
  rows: number;
  version: string;
};

export const DOLL_STORAGE_KEY = "world-of-solcrafts:doll:parts:v1";
const OLD_DOLL_STORAGE_KEY = "solcraft:doll:parts:v1";

const DEFAULT_PARTS: DollParts = {
  head: 0,
  hair: 0,
  torso: 0,
  legs: 0,
  back: 0,
  tool: 0,
  showBack: false,
  showTool: false,
  // Old fields are kept only so old localStorage/server appearance payloads load.
  skin: 0,
  face: 0,
  hat: 0,
  showHat: false,
};

export const DEFAULT_DOLL_PALETTE: Required<DollPalette> = {
  skin: "#f0b887",
  hair: "#f4f0dd",
  primaryCloth: "#31507d",
  secondaryCloth: "#d6aa54",
  leather: "#6a4124",
  metal: "#b8c2cc",
};

const portraitCache = new Map<string, string>();
const textureCache = new Map<string, THREE.CanvasTexture>();
const atlasImageCache = new Map<string, HTMLImageElement>();
const MAX_PORTRAIT_CACHE = 80;
const MAX_TEXTURE_CACHE = 64;
const MAX_ATLAS_IMAGE_CACHE = 8;
function touchMap<K, V>(map: Map<K, V>, key: K): V | undefined {
  if (!map.has(key)) return undefined;
  const value = map.get(key)!;
  map.delete(key);
  map.set(key, value);
  return value;
}
function putBounded<K, V>(map: Map<K, V>, key: K, value: V, max: number, dispose?: (value: V) => void) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const first = map.entries().next().value;
    if (!first) break;
    const [oldKey, oldValue] = first;
    map.delete(oldKey);
    if (oldValue !== value) dispose?.(oldValue);
  }
  return value;
}

let runtimeCache: RuntimeDoll | null = null;
let runtimePromise: Promise<RuntimeDoll | null> | null = null;
let runtimeSig = "boot";

const BOX = {
  back:   { x: 52,  y: 78,  w: 152, h: 142 },
  legs:   { x: 78,  y: 148, w: 100, h: 84 },
  torso:  { x: 62,  y: 86,  w: 132, h: 118 },
  head:   { x: 58,  y: 10,  w: 140, h: 138 },
  hair:   { x: 50,  y: 0,   w: 156, h: 128 },
  tool:   { x: 152, y: 100, w: 90,  h: 112 },
};

function clampInt(n: any, min = 0, max = 7) {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
}

function normalizeHex(value: any, fallback: string) {
  const s = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  return fallback;
}

function hex(n: number | undefined, fallback = "#159c83") {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return `#${(n >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

export function normalizeDollParts(raw: Partial<DollParts> = {}): DollParts {
  const head = clampInt((raw as any).head ?? raw.skin ?? raw.face, 0, 7);
  return {
    head,
    hair: clampInt(raw.hair, 0, 7),
    torso: clampInt(raw.torso, 0, 7),
    legs: clampInt(raw.legs, 0, 7),
    back: clampInt(raw.back, 0, 7),
    tool: clampInt(raw.tool, 0, 7),
    showBack: raw.showBack ?? false,
    showTool: raw.showTool ?? false,
    // Deprecated mirror fields. Never drawn independently.
    skin: head,
    face: head,
    hat: 0,
    showHat: false,
  };
}

export function normalizeDollPalette(raw: Partial<DollPalette> = {}): Required<DollPalette> {
  return {
    skin: normalizeHex(raw.skin, DEFAULT_DOLL_PALETTE.skin),
    hair: normalizeHex(raw.hair, DEFAULT_DOLL_PALETTE.hair),
    primaryCloth: normalizeHex(raw.primaryCloth, DEFAULT_DOLL_PALETTE.primaryCloth),
    secondaryCloth: normalizeHex(raw.secondaryCloth, DEFAULT_DOLL_PALETTE.secondaryCloth),
    leather: normalizeHex(raw.leather, DEFAULT_DOLL_PALETTE.leather),
    metal: normalizeHex(raw.metal, DEFAULT_DOLL_PALETTE.metal),
  };
}

export function loadSavedDollParts(): DollParts {
  try {
    const raw = localStorage.getItem(DOLL_STORAGE_KEY) || localStorage.getItem(OLD_DOLL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PARTS };
    return normalizeDollParts({ ...DEFAULT_PARTS, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_PARTS };
  }
}

export function saveDollParts(parts: Partial<DollParts>): DollParts {
  const saved = normalizeDollParts({ ...DEFAULT_PARTS, ...parts });
  try {
    localStorage.setItem(DOLL_STORAGE_KEY, JSON.stringify(saved));
    localStorage.setItem(OLD_DOLL_STORAGE_KEY, JSON.stringify(saved));
  } catch {}
  // Do not dispose live Doll textures while a sprite is mounted in the world.
  // New appearances naturally get new cache keys from their config; old mounted
  // sprites keep a valid map until their rig is replaced. Runtime atlas reloads
  // can still call clearDollTextureCache() explicitly.
  return saved;
}


function withCacheBust(src: string, sig: string) {
  const clean = String(src || "");
  const sep = clean.includes("?") ? "&" : "?";
  return `${clean}${sep}dollRt=${encodeURIComponent(sig || String(Date.now()))}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = touchMap(atlasImageCache, src);
  if (cached?.complete) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      putBounded(atlasImageCache, src, img, MAX_ATLAS_IMAGE_CACHE);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Doll atlas image load failed"));
    img.src = src;
  });
}

async function fetchRuntimeDoll(): Promise<RuntimeDoll | null> {
  if (runtimeCache) return runtimeCache;
  if (runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    try {
      const res = await fetch("/api/atlas-runtime", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const raw = json?.atlases?.doll || json?.runtime?.doll || json?.doll;
      if (!raw?.url) return null;

      const version = String(raw.version || raw.versionId || raw.url || Date.now());
      const b = raw.bounds || { x0: 0, y0: 0, x1: 1024, y1: 1024 };
      const rt: RuntimeDoll = {
        url: withCacheBust(String(raw.url), version),
        bounds: {
          x0: Number(b.x0 || 0),
          y0: Number(b.y0 || 0),
          x1: Number(b.x1 || 1024),
          y1: Number(b.y1 || 1024),
        },
        pad: Number(raw.pad || 0) || 0,
        cells: Number(raw.cells || raw.cols || 8) || 8,
        cols: Number(raw.cols || raw.cells || 8) || 8,
        rows: Number(raw.rows || raw.cells || 6) || 6,
        version,
      };
      runtimeCache = rt;
      runtimeSig = rt.version;
      return rt;
    } catch {
      return null;
    } finally {
      runtimePromise = null;
    }
  })();

  return runtimePromise;
}

export function heldToolToDollToolSlot(tool: DollHeldTool | string | undefined): number {
  switch (tool) {
    case "axe": return 0;
    case "pickaxe": return 1;
    case "staff": return 2;
    case "sword": return 3;
    case "hammer": return 4;
    case "shovel": return 5;
    case "spear": return 6;
    case "sickle": return 7;
    default: return 0;
  }
}

export function activeHeldToolFromEquip(equip: any = {}): DollHeldTool {
  const toolId = equip?.tool || equip?.mainhand || equip?.hand || equip?.heldTool || "";
  const text = String(toolId?.id || toolId?.name || toolId || "").toLowerCase();

  if (text.includes("axe") || text.includes("wood")) return "axe";
  if (text.includes("pick") || text.includes("stone") || text.includes("mine")) return "pickaxe";
  if (text.includes("staff") || text.includes("wand") || text.includes("use") || text.includes("scroll")) return "staff";
  if (text.includes("sword") || text.includes("blade")) return "sword";
  if (text.includes("hammer")) return "hammer";
  if (text.includes("shovel")) return "shovel";
  if (text.includes("spear")) return "spear";
  if (text.includes("sickle")) return "sickle";
  return "none";
}

function extractPartCanvas(img: HTMLImageElement, rt: RuntimeDoll, slot: number): HTMLCanvasElement {
  const b = rt.bounds;
  const cols = rt.cols || rt.cells || 8;
  const rows = rt.rows || rt.cells || 6;
  const pad = rt.pad || 0;

  const w = Math.max(1, b.x1 - b.x0);
  const h = Math.max(1, b.y1 - b.y0);
  const cw = w / cols;
  const ch = h / rows;

  const col = slot % cols;
  const row = Math.floor(slot / cols);

  const sx = Math.round(b.x0 + col * cw + pad);
  const sy = Math.round(b.y0 + row * ch + pad);
  const sw = Math.max(1, Math.round(cw - pad * 2));
  const sh = Math.max(1, Math.round(ch - pad * 2));

  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256);
  return alphaTrimCanvas(cv, 8);
}

function alphaTrimCanvas(src: HTMLCanvasElement, threshold = 8): HTMLCanvasElement {
  const ctx = src.getContext("2d")!;
  const data = ctx.getImageData(0, 0, src.width, src.height).data;

  let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = data[(y * src.width + x) * 4 + 3];
      if (a > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return src;

  const pad = 3;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(src.width - 1, maxX + pad);
  maxY = Math.min(src.height - 1, maxY + pad);

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  const out = document.createElement("canvas");
  out.width = 256;
  out.height = 256;
  const octx = out.getContext("2d")!;
  octx.clearRect(0, 0, 256, 256);
  octx.drawImage(src, minX, minY, w, h, 0, 0, 256, 256);
  return out;
}

function tintCanvas(src: HTMLCanvasElement, color: string, strength = 0.45): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;

  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = Math.max(0, Math.min(1, strength));
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.restore();

  return out;
}

function tintSkinCanvas(src: HTMLCanvasElement, color: string, strength = 0.52): HTMLCanvasElement {
  // Recolor the skin/head area while putting eyes, brows, mouth, outlines and
  // expressive details back on top. This makes skin color presets visible even
  // with complete painted Doll v3 heads.
  const tinted = tintCanvas(src, color, strength);
  const details = sanitizeFaceOverlay(src);
  const ctx = tinted.getContext("2d")!;
  ctx.drawImage(details, 0, 0);
  return tinted;
}

function sanitizeFaceOverlay(src: HTMLCanvasElement, skinRef?: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;

  const sctx = src.getContext("2d")!;
  const octx = out.getContext("2d")!;

  const srcData = sctx.getImageData(0, 0, src.width, src.height);
  const outData = octx.createImageData(src.width, src.height);

  const refData = skinRef
    ? skinRef.getContext("2d")!.getImageData(0, 0, skinRef.width, skinRef.height)
    : null;

  for (let i = 0; i < srcData.data.length; i += 4) {
    const r = srcData.data[i];
    const g = srcData.data[i + 1];
    const b = srcData.data[i + 2];
    const a = srcData.data[i + 3];

    if (a < 10) continue;

    const brightness = (r + g + b) / 3;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);

    let keep = false;

    // eyes, brows, mouth, dark outlines
    if (brightness < 105) keep = true;

    // blush/tears/special expression details
    if (saturation > 50 && brightness < 220) keep = true;

    // Strip full-head face row pixels if they match the chosen skin base.
    if (refData) {
      const rr = refData.data[i];
      const gg = refData.data[i + 1];
      const bb = refData.data[i + 2];
      const dist = Math.abs(r - rr) + Math.abs(g - gg) + Math.abs(b - bb);
      if (dist < 42) keep = false;
    }

    if (keep) {
      outData.data[i] = r;
      outData.data[i + 1] = g;
      outData.data[i + 2] = b;
      outData.data[i + 3] = a;
    }
  }

  octx.putImageData(outData, 0, 0);
  return out;
}

function drawLayerCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }) {
  ctx.drawImage(canvas, box.x, box.y, box.w, box.h);
}

function drawShadow(ctx: CanvasRenderingContext2D, size: number) {
  ctx.save();
  ctx.globalAlpha = 0.24;
  const g = ctx.createRadialGradient(size / 2, size * 0.86, 2, size / 2, size * 0.86, size * 0.22);
  g.addColorStop(0, "rgba(0,0,0,.8)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

export function drawProceduralDoll(ctx: CanvasRenderingContext2D, config: DollConfig = {}, size = 256) {
  const p = normalizeDollParts({ ...DEFAULT_PARTS, ...(config.dollParts || {}) });
  const palette = normalizeDollPalette(config.palette || {});
  const body = hex(config.body, palette.primaryCloth);
  // Hat rendering is intentionally disabled in Doll v3.

  ctx.clearRect(0, 0, size, size);
  drawShadow(ctx, size);

  const sx = size / 256;
  ctx.save();
  ctx.scale(sx, sx);

  // legs
  ctx.fillStyle = palette.secondaryCloth;
  ctx.fillRect(92, 142, 28, 62);
  ctx.fillRect(136, 142, 28, 62);

  // boots
  ctx.fillStyle = palette.leather;
  ctx.fillRect(84, 198, 42, 16);
  ctx.fillRect(130, 198, 42, 16);

  // torso
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect?.(70, 82, 116, 88, 16);
  if (!ctx.roundRect) ctx.rect(70, 82, 116, 88);
  ctx.fill();

  // belt
  ctx.fillStyle = palette.leather;
  ctx.fillRect(72, 138, 112, 10);

  // head
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(128, 58, 42, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.beginPath();
  ctx.arc(85, 61, 10, 0, Math.PI * 2);
  ctx.arc(171, 61, 10, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = palette.hair;
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 10;
    ctx.beginPath();
    ctx.arc(x, 30 + (i % 2) * 8, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // face
  ctx.fillStyle = "#17110d";
  ctx.beginPath();
  ctx.arc(113, 60, 4, 0, Math.PI * 2);
  ctx.arc(143, 60, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#17110d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 75, 13, 0.1, Math.PI - 0.1);
  ctx.stroke();

  const held = config.heldTool || activeHeldToolFromEquip(config.equip || {});
  if (held && held !== "none") {
    ctx.strokeStyle = palette.leather;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(178, 116);
    ctx.lineTo(206, 178);
    ctx.stroke();
    ctx.fillStyle = palette.metal;
    ctx.beginPath();
    ctx.arc(178, 110, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawDoll(ctx: CanvasRenderingContext2D, config: DollConfig = {}, size = 256) {
  // Synchronous compatibility path.
  drawProceduralDoll(ctx, config, size);
}

export async function composeDollCanvas(canvas: HTMLCanvasElement, config: DollConfig = {}, size = 256) {
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  if (FORCE_FALLBACK_DOLL_ATLAS) {
    drawProceduralDoll(ctx, config, size);
    return canvas;
  }

  const rt = await fetchRuntimeDoll();
  if (!rt?.url) {
    drawProceduralDoll(ctx, config, size);
    return canvas;
  }

  try {
    const img = await loadImage(rt.url);
    const saved = config.useSavedParts ? loadSavedDollParts() : {};
    const p = normalizeDollParts({ ...DEFAULT_PARTS, ...saved, ...(config.dollParts || {}) });
    const palette = normalizeDollPalette(config.palette || {});

    const temp = document.createElement("canvas");
    temp.width = temp.height = 256;
    const tctx = temp.getContext("2d")!;
    tctx.clearRect(0, 0, 256, 256);
    drawShadow(tctx, 256);

    if (p.showBack) {
      const back = tintCanvas(extractPartCanvas(img, rt, 32 + p.back), palette.leather, 0.28);
      drawLayerCanvas(tctx, back, BOX.back);
    }

    const legs = tintCanvas(extractPartCanvas(img, rt, 24 + p.legs), palette.secondaryCloth, 0.38);
    drawLayerCanvas(tctx, legs, BOX.legs);

    const torso = tintCanvas(extractPartCanvas(img, rt, 16 + p.torso), palette.primaryCloth, 0.38);
    drawLayerCanvas(tctx, torso, BOX.torso);

    // Doll v3 heads are complete readable heads/faces. Recolor the base skin/head
    // with the selected skin preset, then restore facial details over it.
    const head = tintSkinCanvas(extractPartCanvas(img, rt, p.head), palette.skin, 0.52);
    drawLayerCanvas(tctx, head, BOX.head);

    const hair = tintCanvas(extractPartCanvas(img, rt, 8 + p.hair), palette.hair, 0.34);
    drawLayerCanvas(tctx, hair, BOX.hair);

    const held = config.heldTool || activeHeldToolFromEquip(config.equip || {});
    const showTool = held && held !== "none";
    if (showTool || p.showTool) {
      const toolSlot = showTool ? heldToolToDollToolSlot(held) : p.tool;
      const tool = tintCanvas(extractPartCanvas(img, rt, 40 + toolSlot), palette.metal, 0.18);
      drawLayerCanvas(tctx, tool, BOX.tool);
    }

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(temp, 0, 0, size, size);
    return canvas;
  } catch {
    drawProceduralDoll(ctx, config, size);
    return canvas;
  }
}

export async function dollPortraitDataUrl(config: DollConfig = {}, size = 256) {
  const key = `portrait:${runtimeSig}:${size}:${JSON.stringify(config || {})}`;
  const cached = touchMap(portraitCache, key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  await composeDollCanvas(canvas, config, size);
  const url = canvas.toDataURL("image/png");
  putBounded(portraitCache, key, url, MAX_PORTRAIT_CACHE);
  return url;
}

export function dollTexture(config: DollConfig = {}, size = 256) {
  const key = `tex:${runtimeSig}:${size}:${JSON.stringify(config || {})}`;
  const cached = touchMap(textureCache, key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  drawProceduralDoll(canvas.getContext("2d")!, config, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  putBounded(textureCache, key, tex, MAX_TEXTURE_CACHE, (t) => t.dispose?.());

  composeDollCanvas(canvas, config, size).then(() => {
    tex.image = canvas;
    tex.needsUpdate = true;
  }).catch(() => {});

  return tex;
}

export function buildDollBillboard(config: DollConfig = {}) {
  const map = dollTexture(config, 384);
  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    alphaTest: 0.06,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, 0.9, 1);
  sprite.position.y = 0.42;

  const group = new THREE.Group();
  group.add(sprite);
  group.userData = { dollBillboard: true, config };
  return group;
}

export function clearDollTextureCache() {
  portraitCache.clear();
  textureCache.forEach((t) => t.dispose?.());
  textureCache.clear();
  atlasImageCache.clear();
  runtimeCache = null;
  runtimePromise = null;
  runtimeSig = `clear:${Date.now()}`;
}
