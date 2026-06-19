import {
  WORLD_WONDER_MAX_PARTS,
  WORLD_WONDER_PROMPT_MAX,
  WORLD_WONDER_SCHEMA_VERSION,
  WORLD_WONDER_PLAZA_RADIUS,
} from "./shared";

export type WonderPrimitive = "box" | "cylinder" | "cone" | "sphere" | "torus" | "octahedron";

export type WonderPart = {
  primitive: WonderPrimitive;
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
  color: string;
  emissive?: string;
  metalness?: number;
  roughness?: number;
};

export type WonderMode = "single" | "district";

export type WonderRecipe = {
  v: number;
  name: string;
  prompt: string;
  palette: string[];
  parts: WonderPart[];
  aura?: "none" | "gold" | "mint" | "violet" | "blue";
  /** Odd plaza footprint size. Existing recipes without this default to 9. */
  footprint?: 3 | 5 | 7 | 9;
  /** single = one landmark mass, district = multiple coordinated clusters. */
  mode?: WonderMode;
  /** Operator/player chosen palette id for recoloring. */
  paletteId?: string;
  /** Build duration derived from footprint/mode, stored in recipe so no DB migration is needed. */
  buildMs?: number;
};

const PRIMITIVES = new Set<WonderPrimitive>(["box", "cylinder", "cone", "sphere", "torus", "octahedron"]);
const AURAS = new Set(["none", "gold", "mint", "violet", "blue"]);

const WONDER_FOOTPRINTS = [3, 5, 7, 9] as const;
const WONDER_MODES = new Set(["single", "district"]);

export const WONDER_PALETTE_SCHEMES: Record<string, string[]> = {
  solar: ["#fff0a8", "#ffd76e", "#c79337", "#14f195", "#063b2c", "#f3ead7"],
  arcane: ["#f3ead7", "#9945ff", "#5a2d91", "#7dcfe8", "#24113f", "#d9b8ff"],
  emerald: ["#dfffee", "#14f195", "#0d7054", "#7dcfe8", "#063b2c", "#f3ead7"],
  ember: ["#ffe3c2", "#ffb45e", "#d6604f", "#8e3d26", "#3b1d12", "#ffd76e"],
  frost: ["#ecfbff", "#b8e9ff", "#7dcfe8", "#31507d", "#102038", "#f3ead7"],
  royal: ["#fff0a8", "#9945ff", "#4d287f", "#ffd76e", "#1b102b", "#f3ead7"],
};

export function normalizeWonderFootprint(value: any): 3 | 5 | 7 | 9 {
  const n = Math.trunc(Number(value || 9));
  return (WONDER_FOOTPRINTS as readonly number[]).includes(n) ? (n as 3 | 5 | 7 | 9) : 9;
}
export function wonderFootprintRadius(recipeOrSize: any): number {
  return Math.max(1, Math.floor((normalizeWonderFootprint(typeof recipeOrSize === "number" ? recipeOrSize : recipeOrSize?.footprint) - 1) / 2));
}
export function wonderFootprintTiles(recipeOrSize: any): number {
  const size = normalizeWonderFootprint(typeof recipeOrSize === "number" ? recipeOrSize : recipeOrSize?.footprint);
  return size * size;
}
export function normalizeWonderMode(value: any): WonderMode {
  const v = String(value || "district").toLowerCase();
  return WONDER_MODES.has(v) ? (v as WonderMode) : "district";
}
export function normalizeWonderPaletteId(value: any): string {
  const v = String(value || "solar").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return WONDER_PALETTE_SCHEMES[v] ? v : "solar";
}
export function wonderPaletteColors(id: any): string[] {
  return [...WONDER_PALETTE_SCHEMES[normalizeWonderPaletteId(id)]];
}
export function wonderBuildMsFor(recipeOrSize: any): number {
  const size = normalizeWonderFootprint(typeof recipeOrSize === "number" ? recipeOrSize : recipeOrSize?.footprint);
  const mode = normalizeWonderMode(typeof recipeOrSize === "object" ? recipeOrSize?.mode : "district");
  const base = size === 3 ? 24000 : size === 5 ? 32000 : size === 7 ? 40000 : 48000;
  return mode === "single" ? Math.max(22000, base - 4000) : base;
}
function cleanWonderName(value: any, fallback: string) {
  return String(value || fallback || "World Wonder")
    .replace(/[<>`{}]/g, " ")
    .replace(/[^ws'’-]/g, "")
    .replace(/s+/g, " ")
    .trim()
    .slice(0, 42) || fallback || "World Wonder";
}
function prepareWonderParts(parts: WonderPart[], palette: string[], footprint: 3 | 5 | 7 | 9, mode: WonderMode) {
  const pal = palette.length ? palette : wonderPaletteColors("solar");
  const r = Math.max(1, (footprint - 1) / 2);
  const maxXZ = Math.max(0.65, r - 0.42);
  const compress = mode === "single" ? 0.58 : 1;
  return parts.map((part, i) => {
    const accentEvery = i % 7 === 0;
    const color = pal[i % pal.length];
    const emissive = accentEvery ? pal[(i + 2) % pal.length] : part.emissive;
    const x = clamp(Number(part?.pos?.[0] || 0) * compress, -maxXZ, maxXZ);
    const z = clamp(Number(part?.pos?.[2] || 0) * compress, -maxXZ, maxXZ);
    const sx = clamp(Number(part?.scale?.[0] || 1) * (mode === "single" ? 1.08 : 0.92), 0.035, Math.max(0.38, r * 0.64));
    const sz = clamp(Number(part?.scale?.[2] || 1) * (mode === "single" ? 1.08 : 0.92), 0.035, Math.max(0.38, r * 0.64));
    const sy = clamp(Number(part?.scale?.[1] || 1), 0.035, 6.4);
    return { ...part, pos: [x, part.pos?.[1] || 0, z] as [number, number, number], scale: [sx, sy, sz] as [number, number, number], color, emissive };
  });
}
export function applyWonderDesignOptions(recipe: WonderRecipe, opts: any = {}): WonderRecipe {
  const footprint = normalizeWonderFootprint(opts.footprint ?? opts.size ?? recipe.footprint);
  const mode = normalizeWonderMode(opts.mode ?? recipe.mode);
  const paletteId = normalizeWonderPaletteId(opts.paletteId ?? recipe.paletteId);
  const palette = Array.isArray(opts.palette) && opts.palette.length
    ? opts.palette.slice(0, 8).map((x: any) => cleanHex(x)).filter(Boolean)
    : wonderPaletteColors(paletteId);
  const name = cleanWonderName(opts.name ?? opts.wonderName ?? recipe.name, recipe.name || prettyName(recipe.prompt || opts.prompt || ""));
  return {
    ...recipe,
    name,
    footprint,
    mode,
    paletteId,
    palette,
    buildMs: wonderBuildMsFor({ footprint, mode }),
    parts: prepareWonderParts(recipe.parts || [], palette, footprint, mode),
  };
}


function clamp(n: any, min: number, max: number) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : min;
}

function cleanHex(v: any, fallback = "#fff0a8") {
  const s = String(v || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

function hashText(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], h: number, offset = 0): T {
  return arr[(h + offset) % arr.length];
}

function prettyName(prompt: string) {
  const words = cleanWonderPrompt(prompt)
    .replace(/[^a-z0-9s'-]/gi, " ")
    .split(/s+/)
    .filter(Boolean)
    .slice(0, 5);
  if (!words.length) return "Frontier Wonder";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function cleanWonderPrompt(prompt: any) {
  return String(prompt || "")
    .replace(/[<>`{}]/g, " ")
    .replace(/s+/g, " ")
    .trim()
    .slice(0, WORLD_WONDER_PROMPT_MAX);
}

export function validateWonderRecipe(raw: any, prompt: string): WonderRecipe {
  const cleanPrompt = cleanWonderPrompt(prompt || raw?.prompt);
  const fallback = fallbackWonderRecipe(cleanPrompt);
  const partsRaw = Array.isArray(raw?.parts) ? raw.parts : [];

  const parts: WonderPart[] = partsRaw.slice(0, WORLD_WONDER_MAX_PARTS).map((p: any) => {
    const primitive = PRIMITIVES.has(p?.primitive) ? p.primitive : "box";
    return {
      primitive,
      pos: [
        clamp(p?.pos?.[0], -WORLD_WONDER_PLAZA_RADIUS + 0.65, WORLD_WONDER_PLAZA_RADIUS - 0.65),
        clamp(p?.pos?.[1], 0.02, 6.8),
        clamp(p?.pos?.[2], -WORLD_WONDER_PLAZA_RADIUS + 0.65, WORLD_WONDER_PLAZA_RADIUS - 0.65),
      ],
      scale: [
        clamp(p?.scale?.[0], 0.04, 2.8),
        clamp(p?.scale?.[1], 0.04, 6.4),
        clamp(p?.scale?.[2], 0.04, 2.8),
      ],
      rot: [
        clamp(p?.rot?.[0], -Math.PI * 2, Math.PI * 2),
        clamp(p?.rot?.[1], -Math.PI * 2, Math.PI * 2),
        clamp(p?.rot?.[2], -Math.PI * 2, Math.PI * 2),
      ],
      color: cleanHex(p?.color),
      emissive: p?.emissive ? cleanHex(p.emissive, "#000000") : undefined,
      metalness: clamp(p?.metalness ?? 0.05, 0, 1),
      roughness: clamp(p?.roughness ?? 0.82, 0, 1),
    };
  });

  const name = String(raw?.name || fallback.name)
    .replace(/[^ws'’-]/g, "")
    .replace(/s+/g, " ")
    .trim()
    .slice(0, 42) || fallback.name;

  const palette = Array.isArray(raw?.palette)
    ? raw.palette.slice(0, 8).map((x: any) => cleanHex(x)).filter(Boolean)
    : fallback.palette;

  const aura = AURAS.has(String(raw?.aura)) ? raw.aura : fallback.aura;

  const footprint = normalizeWonderFootprint(raw?.footprint ?? fallback.footprint);
  const mode = normalizeWonderMode(raw?.mode ?? fallback.mode);
  const paletteId = normalizeWonderPaletteId(raw?.paletteId ?? fallback.paletteId);
  return {
    v: WORLD_WONDER_SCHEMA_VERSION,
    name,
    prompt: cleanPrompt,
    palette: palette.length ? palette : fallback.palette,
    parts: parts.length ? parts : fallback.parts,
    aura,
    footprint,
    mode,
    paletteId,
    buildMs: wonderBuildMsFor({ footprint, mode }),
  };
}


export function assertRealWonderRecipe(raw: any, prompt = ""): WonderRecipe {
  if (!raw || typeof raw !== "object") throw new Error("AI recipe must be a JSON object.");
  const partsRaw = Array.isArray(raw?.parts) ? raw.parts : [];
  if (partsRaw.length < 12) throw new Error("AI recipe must contain at least 12 mesh parts for the selected Wonder plaza. No fallback recipe will be used.");
  if (partsRaw.length > WORLD_WONDER_MAX_PARTS) throw new Error(`AI recipe has too many parts (${partsRaw.length}/${WORLD_WONDER_MAX_PARTS}).`);
  for (let i = 0; i < partsRaw.length; i++) {
    const part = partsRaw[i] || {};
    if (!PRIMITIVES.has(part.primitive)) throw new Error(`AI recipe part ${i + 1} has invalid primitive '${String(part.primitive || "")}'.`);
    if (!Array.isArray(part.pos) || part.pos.length !== 3) throw new Error(`AI recipe part ${i + 1} is missing pos[3].`);
    if (!Array.isArray(part.scale) || part.scale.length !== 3) throw new Error(`AI recipe part ${i + 1} is missing scale[3].`);
    if (part.color && !/^#[0-9a-f]{6}$/i.test(String(part.color))) throw new Error(`AI recipe part ${i + 1} has invalid color.`);
  }
  const recipe = validateWonderRecipe(raw, prompt || raw?.prompt);
  if (!recipe.parts.length) throw new Error("AI recipe validated to zero parts. Refusing to use fallback.");
  return recipe;
}

export function fallbackWonderRecipe(prompt: string): WonderRecipe {
  const cleanPrompt = cleanWonderPrompt(prompt);
  const h = hashText(cleanPrompt || "frontier wonder");
  const palettes = [
    ["#fff0a8", "#ffd76e", "#c79337", "#14f195", "#063b2c"],
    ["#f3ead7", "#7dcfe8", "#31507d", "#9945ff", "#24113f"],
    ["#ffe3c2", "#d6604f", "#8e3d26", "#ffb45e", "#3b1d12"],
    ["#dfffee", "#14f195", "#0d7054", "#9a7cff", "#120c2d"],
  ];
  const palette = pick(palettes, h);
  const towerCount = 5 + (h % 5);
  const radius = 2.0 + ((h >> 3) % 8) * 0.16;
  const parts: WonderPart[] = [
    { primitive: "box", pos: [0, 0.08, 0], scale: [3.2, 0.16, 3.2], color: palette[2], roughness: 0.92 },
    { primitive: "cylinder", pos: [0, 0.32, 0], scale: [1.7, 0.24, 1.7], color: palette[0], emissive: palette[4], roughness: 0.75 },
    { primitive: "sphere", pos: [0, 2.85, 0], scale: [0.38, 0.38, 0.38], color: palette[3], emissive: palette[3], roughness: 0.45 },
  ];

  for (let i = 0; i < towerCount; i++) {
    const a = (Math.PI * 2 * i) / towerCount + ((h >> 8) % 31) / 100;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const height = 1.0 + (((h >> (i + 4)) & 7) * 0.12);
    parts.push({ primitive: "cylinder", pos: [x, 0.9 + height * 0.35, z], scale: [0.18, height, 0.18], color: palette[i % palette.length], roughness: 0.72 });
    parts.push({ primitive: "cone", pos: [x, 1.72 + height * 0.7, z], scale: [0.32, 0.62, 0.32], color: palette[(i + 1) % palette.length], emissive: i % 2 ? undefined : palette[4], roughness: 0.62 });
  }

  const archCount = 4 + ((h >> 12) % 3);
  for (let i = 0; i < archCount; i++) {
    const a = (Math.PI * 2 * i) / archCount + Math.PI / archCount;
    parts.push({
      primitive: "torus",
      pos: [Math.cos(a) * 0.74, 1.15, Math.sin(a) * 0.74],
      scale: [0.55, 0.55, 0.55],
      rot: [Math.PI / 2, 0, -a],
      color: palette[(i + 2) % palette.length],
      emissive: palette[4],
      roughness: 0.5,
    });
  }

  parts.push({ primitive: "octahedron", pos: [0, 3.45, 0], scale: [0.46, 0.46, 0.46], color: palette[3], emissive: palette[3], metalness: 0.2, roughness: 0.28 });

  return {
    v: WORLD_WONDER_SCHEMA_VERSION,
    name: prettyName(cleanPrompt),
    prompt: cleanPrompt,
    palette,
    aura: pick(["gold", "mint", "violet", "blue"] as const, h, 5),
    parts: parts.slice(0, WORLD_WONDER_MAX_PARTS),
    footprint: 9,
    mode: "district",
    paletteId: "solar",
    buildMs: wonderBuildMsFor({ footprint: 9, mode: "district" }),
  };
}
