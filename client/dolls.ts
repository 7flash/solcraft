// @ts-nocheck
/**
 * Canvas-safe Doll compatibility layer.
 *
 * The live Canvas renderer no longer needs Three.js billboards, but profile and
 * character UI still depend on the Doll data model.  This file preserves that
 * API without importing Three or allocating WebGL textures.
 */
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

export type DollHeldTool = "none" | "axe" | "pickaxe" | "staff" | "sword" | "hammer" | "shovel" | "spear" | "sickle";

export type DollPalette = {
  skin?: string;
  hair?: string;
  primaryCloth?: string;
  secondaryCloth?: string;
  leather?: string;
  metal?: string;
};

export type DollParts = {
  head: number;
  hair: number;
  torso: number;
  legs: number;
  back: number;
  tool: number;
  skin?: number;
  face?: number;
  hat?: number;
  showBack?: boolean;
};

export type DollConfig = {
  parts?: Partial<DollParts>;
  palette?: Partial<DollPalette>;
  equip?: DollEquip;
  tool?: DollHeldTool | string;
  showBack?: boolean;
};

export const DOLL_STORAGE_KEY = "world-of-solcrafts:doll:parts:v1";

export const DEFAULT_DOLL_PALETTE: Required<DollPalette> = {
  skin: "#f1c27d",
  hair: "#4a3426",
  primaryCloth: "#2f952f",
  secondaryCloth: "#ceb443",
  leather: "#6e4b27",
  metal: "#9aa6ad",
};

const DEFAULT_PARTS: DollParts = {
  head: 0,
  hair: 0,
  torso: 0,
  legs: 0,
  back: 0,
  tool: 0,
  showBack: false,
};

function n(v: any, fallback = 0) {
  const x = Math.trunc(Number(v));
  return Number.isFinite(x) ? Math.max(0, Math.min(7, x)) : fallback;
}

function color(v: any, fallback: string) {
  const s = String(v || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) || /^#[0-9a-f]{3}$/i.test(s) ? s : fallback;
}

export function normalizeDollParts(raw: Partial<DollParts> = {}): DollParts {
  return {
    head: n(raw.head ?? raw.skin ?? raw.face, DEFAULT_PARTS.head),
    hair: n(raw.hair, DEFAULT_PARTS.hair),
    torso: n(raw.torso, DEFAULT_PARTS.torso),
    legs: n(raw.legs, DEFAULT_PARTS.legs),
    back: n(raw.back, DEFAULT_PARTS.back),
    tool: n(raw.tool, DEFAULT_PARTS.tool),
    skin: n(raw.skin ?? raw.head, DEFAULT_PARTS.head),
    face: n(raw.face ?? raw.head, DEFAULT_PARTS.head),
    hat: n(raw.hat ?? raw.hair, DEFAULT_PARTS.hair),
    showBack: !!raw.showBack,
  };
}

export function normalizeDollPalette(raw: Partial<DollPalette> = {}): Required<DollPalette> {
  return {
    skin: color(raw.skin, DEFAULT_DOLL_PALETTE.skin),
    hair: color(raw.hair, DEFAULT_DOLL_PALETTE.hair),
    primaryCloth: color(raw.primaryCloth, DEFAULT_DOLL_PALETTE.primaryCloth),
    secondaryCloth: color(raw.secondaryCloth, DEFAULT_DOLL_PALETTE.secondaryCloth),
    leather: color(raw.leather, DEFAULT_DOLL_PALETTE.leather),
    metal: color(raw.metal, DEFAULT_DOLL_PALETTE.metal),
  };
}

export function loadSavedDollParts(): DollParts {
  try {
    const raw = JSON.parse(localStorage.getItem(DOLL_STORAGE_KEY) || "{}");
    return normalizeDollParts(raw || {});
  } catch {
    return normalizeDollParts();
  }
}

export function saveDollParts(parts: Partial<DollParts>): DollParts {
  const normalized = normalizeDollParts(parts || {});
  try { localStorage.setItem(DOLL_STORAGE_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}

export function heldToolToDollToolSlot(tool: DollHeldTool | string | undefined): number {
  const t = String(tool || "none").toLowerCase();
  const map: Record<string, number> = { none: 0, axe: 1, pickaxe: 2, staff: 3, sword: 4, hammer: 5, shovel: 6, spear: 7, sickle: 7 };
  return map[t] ?? 0;
}

export function activeHeldToolFromEquip(equip: any = {}): DollHeldTool {
  const v = String(equip?.hand || equip?.mainhand || equip?.tool || "none").toLowerCase();
  if (["axe", "pickaxe", "staff", "sword", "hammer", "shovel", "spear", "sickle"].includes(v)) return v as DollHeldTool;
  return "none";
}

function drawRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  try {
    ctx.beginPath();
    (ctx as any).roundRect?.(x, y, w, h, r);
    if (!(ctx as any).roundRect) {
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    }
  } catch { ctx.rect(x, y, w, h); }
}

export function drawProceduralDoll(ctx: CanvasRenderingContext2D, config: DollConfig = {}, size = 256) {
  const pal = normalizeDollPalette(config.palette || {});
  const parts = normalizeDollParts(config.parts || {});
  const s = size / 256;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(s, s);
  ctx.translate(128, 128);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(0, 84, 48, 14, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = pal.secondaryCloth;
  if (config.showBack || parts.showBack) { drawRounded(ctx, -34, -16, 68, 96, 22); ctx.fill(); }

  ctx.fillStyle = pal.primaryCloth;
  drawRounded(ctx, -33, -18, 66, 86, 18); ctx.fill();
  ctx.fillStyle = pal.secondaryCloth;
  ctx.fillRect(-30, 26, 60, 12);

  ctx.fillStyle = pal.leather;
  drawRounded(ctx, -28, 54, 22, 42, 8); ctx.fill();
  drawRounded(ctx, 6, 54, 22, 42, 8); ctx.fill();

  ctx.fillStyle = pal.skin;
  drawRounded(ctx, -50, -6, 18, 54, 9); ctx.fill();
  drawRounded(ctx, 32, -6, 18, 54, 9); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -56, 34, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = pal.hair;
  ctx.beginPath(); ctx.arc(0, -70, 34, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(-32, -72, 64, 14);

  ctx.fillStyle = "#17202a";
  ctx.beginPath(); ctx.arc(-11, -56, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(11, -56, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(23,32,42,0.7)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -47, 11, 0.18, Math.PI - 0.18); ctx.stroke();

  const tool = config.tool || activeHeldToolFromEquip(config.equip || {});
  if (String(tool) !== "none") {
    ctx.strokeStyle = pal.metal; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(42, 22); ctx.lineTo(70, -24); ctx.stroke();
  }
  ctx.restore();
}

export function drawDoll(ctx: CanvasRenderingContext2D, config: DollConfig = {}, size = 256) {
  drawProceduralDoll(ctx, config, size);
}

export async function composeDollCanvas(canvas: HTMLCanvasElement, config: DollConfig = {}, size = 256) {
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) drawDoll(ctx, config, size);
  return canvas;
}

export async function dollPortraitDataUrl(config: DollConfig = {}, size = 256) {
  const c = document.createElement("canvas");
  await composeDollCanvas(c, config, size);
  return c.toDataURL("image/png");
}

export function dollTexture(config: DollConfig = {}, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) drawDoll(ctx, config, size);
  return { image: c, canvas: c, needsUpdate: true, userData: { canvasFallback: true } } as any;
}

export function buildDollBillboard(config: DollConfig = {}) {
  return { userData: { canvasFallback: true, config }, visible: true } as any;
}

export function clearDollTextureCache() {}
