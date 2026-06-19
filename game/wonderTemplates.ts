// @ts-nocheck
import {
  applyWonderDesignOptions,
  cleanWonderPrompt,
  normalizeWonderFootprint,
  normalizeWonderMode,
  normalizeWonderPaletteId,
  wonderPaletteColors,
  wonderBuildMsFor,
  type WonderRecipe,
  type WonderPart,
} from "./wonderRecipe";
import { WORLD_WONDER_SCHEMA_VERSION } from "./shared";

export type WonderTemplateId = "school" | "skyscraper" | "academy" | "market" | "temple" | "observatory";

type TemplateMeta = {
  id: WonderTemplateId;
  name: string;
  prompt: string;
  footprint: 3 | 5 | 7 | 9;
  mode: "single" | "district";
  paletteId: string;
  summary: string;
};

export const WONDER_TEMPLATES: TemplateMeta[] = [
  {
    id: "school",
    name: "Frontier Schoolhouse",
    prompt: "a bright friendly school with red brick classrooms, blue roof, many windows, bell tower, flagpole, entrance steps and a small playground",
    footprint: 5,
    mode: "single",
    paletteId: "frost",
    summary: "Readable school: classroom wings, clock/bell tower, windows, flag, entrance, playground accents.",
  },
  {
    id: "skyscraper",
    name: "Skyline Tower",
    prompt: "a clean futuristic skyscraper with stacked glass floors, bright lobby, rooftop spire and precise window grid",
    footprint: 5,
    mode: "single",
    paletteId: "frost",
    summary: "Vertical tower silhouette with repeated floors and clear windows.",
  },
  {
    id: "academy",
    name: "Crystal Academy",
    prompt: "a magical academy campus with crystal lecture hall, observatory dome, science orb and two small study towers",
    footprint: 7,
    mode: "district",
    paletteId: "arcane",
    summary: "Campus layout with study wings, central lecture hall, and science-focused crystal details.",
  },
  {
    id: "market",
    name: "Grand Market",
    prompt: "a lively grand market plaza with colorful stalls, central awning, coin fountain and small vendor booths",
    footprint: 7,
    mode: "district",
    paletteId: "solar",
    summary: "Multiple booths around a central market/fountain element.",
  },
  {
    id: "temple",
    name: "Sun Temple",
    prompt: "a warm sun temple with steps, columns, golden roof, central altar and glowing corner lamps",
    footprint: 7,
    mode: "single",
    paletteId: "solar",
    summary: "Symmetric temple with steps, columns, altar, and readable sacred silhouette.",
  },
  {
    id: "observatory",
    name: "Moon Observatory",
    prompt: "a moon observatory with round dome, telescope, star crystals, stairs and four small night lamps",
    footprint: 5,
    mode: "single",
    paletteId: "royal",
    summary: "Dome/telescope landmark with astronomy props.",
  },
];

function part(primitive: WonderPart["primitive"], pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}): WonderPart {
  return { primitive, pos, scale, rot: extra.rot || [0, 0, 0], color, emissive: extra.emissive || "#000000", metalness: extra.metalness ?? 0.04, roughness: extra.roughness ?? 0.82 };
}
function box(pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}) { return part("box", pos, scale, color, extra); }
function cyl(pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}) { return part("cylinder", pos, scale, color, extra); }
function cone(pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}) { return part("cone", pos, scale, color, extra); }
function sphere(pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}) { return part("sphere", pos, scale, color, extra); }
function torus(pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}) { return part("torus", pos, scale, color, extra); }
function oct(pos: [number, number, number], scale: [number, number, number], color: string, extra: Partial<WonderPart> = {}) { return part("octahedron", pos, scale, color, extra); }

function windows(parts: WonderPart[], xs: number[], y: number, z: number, color = "#dff6ff") {
  for (const x of xs) parts.push(box([x, y, z], [0.11, 0.15, 0.035], color, { emissive: "#274c64", roughness: 0.5 }));
}

function schoolParts(): WonderPart[] {
  const brick = "#b85f50", roof = "#31507d", trim = "#f3ead7", glass = "#dff6ff", dark = "#33201a", gold = "#ffd76e", flag = "#14f195";
  const p: WonderPart[] = [];
  // Classroom body and wings.
  p.push(box([0, 0.48, 0.05], [1.12, 0.88, 0.70], brick));
  p.push(box([-1.18, 0.42, 0.12], [0.76, 0.76, 0.58], brick));
  p.push(box([1.18, 0.42, 0.12], [0.76, 0.76, 0.58], brick));
  p.push(box([0, 0.98, -0.02], [1.30, 0.18, 0.86], roof, { rot: [0, 0.08, 0] }));
  p.push(box([-1.18, 0.86, 0.08], [0.92, 0.16, 0.72], roof, { rot: [0, -0.1, 0] }));
  p.push(box([1.18, 0.86, 0.08], [0.92, 0.16, 0.72], roof, { rot: [0, 0.1, 0] }));
  // Entrance, steps, sign block.
  p.push(box([0, 0.31, -0.39], [0.32, 0.48, 0.08], dark));
  p.push(box([0, 0.08, -0.74], [0.88, 0.10, 0.34], trim));
  p.push(box([0, 0.15, -0.59], [0.58, 0.12, 0.22], gold));
  p.push(box([0, 1.23, -0.46], [0.82, 0.16, 0.06], trim));
  // Bell/clock tower.
  p.push(box([0, 1.24, 0.06], [0.46, 0.72, 0.42], brick));
  p.push(cone([0, 1.84, 0.06], [0.50, 0.55, 0.50], roof));
  p.push(sphere([0, 1.40, -0.18], [0.14, 0.14, 0.05], gold, { emissive: "#5e4b12", roughness: 0.45 }));
  p.push(cyl([0, 1.62, -0.16], [0.12, 0.16, 0.12], gold, { emissive: "#5e4b12" }));
  // Windows on front.
  windows(p, [-0.72, -0.46, 0.46, 0.72], 0.55, -0.34, glass);
  windows(p, [-1.38, -1.08, 1.08, 1.38], 0.48, -0.28, glass);
  windows(p, [-0.16, 0.16], 1.16, -0.18, glass);
  // Flag and playground/readability props.
  p.push(cyl([-1.95, 0.68, -0.62], [0.035, 1.10, 0.035], trim));
  p.push(box([-1.74, 1.15, -0.62], [0.38, 0.20, 0.035], flag, { emissive: "#063b2c" }));
  p.push(torus([1.92, 0.26, -0.78], [0.28, 0.28, 0.28], gold, { rot: [Math.PI / 2, 0, 0], emissive: "#4a3510" }));
  p.push(cyl([1.92, 0.16, -0.78], [0.05, 0.34, 0.05], trim));
  p.push(box([1.62, 0.16, -1.08], [0.48, 0.08, 0.16], roof));
  return p;
}

function skyscraperParts(): WonderPart[] {
  const glass = "#b8e9ff", blue = "#31507d", dark = "#102038", light = "#ecfbff", gold = "#ffd76e";
  const p: WonderPart[] = [];
  p.push(box([0, 0.14, 0], [1.34, 0.20, 1.00], dark));
  p.push(box([0, 1.15, 0], [0.88, 2.10, 0.72], glass, { metalness: 0.18, roughness: 0.42, emissive: "#112a38" }));
  p.push(box([0.06, 2.55, 0.02], [0.72, 0.90, 0.58], blue, { metalness: 0.12, roughness: 0.52 }));
  p.push(box([-0.04, 3.18, 0.02], [0.50, 0.52, 0.42], glass, { metalness: 0.18, roughness: 0.4, emissive: "#112a38" }));
  p.push(cyl([0, 3.78, 0], [0.07, 0.82, 0.07], gold, { emissive: "#3b2a0b" }));
  for (let y = 0.55; y <= 2.65; y += 0.32) for (const x of [-0.32, 0, 0.32]) p.push(box([x, y, -0.39], [0.11, 0.07, 0.025], light, { emissive: "#214052" }));
  p.push(box([0, 0.34, -0.50], [0.42, 0.28, 0.08], gold));
  return p;
}

function academyParts(): WonderPart[] {
  const pal = ["#f3ead7", "#9945ff", "#5a2d91", "#7dcfe8", "#24113f", "#d9b8ff"];
  const p: WonderPart[] = [];
  p.push(box([0, 0.42, 0], [1.18, 0.78, 0.86], pal[0]));
  p.push(cone([0, 1.06, 0], [1.02, 0.42, 1.02], pal[2]));
  p.push(sphere([0, 1.62, -0.08], [0.33, 0.33, 0.33], pal[3], { emissive: pal[3], roughness: 0.28 }));
  for (const x of [-1.55, 1.55]) { p.push(cyl([x, 0.70, 0.1], [0.28, 1.2, 0.28], pal[4])); p.push(cone([x, 1.48, 0.1], [0.46, 0.62, 0.46], pal[1])); }
  for (const z of [-1.35, 1.35]) { p.push(box([0, 0.32, z], [0.84, 0.55, 0.46], pal[5])); p.push(box([0, 0.68, z], [0.96, 0.12, 0.54], pal[1])); }
  p.push(torus([0, 1.46, -0.58], [0.46, 0.46, 0.46], pal[3], { rot: [Math.PI / 2, 0, 0], emissive: pal[3] }));
  p.push(oct([0.9, 0.85, -1.2], [0.22, 0.22, 0.22], pal[3], { emissive: pal[3] }));
  p.push(oct([-0.9, 0.85, 1.2], [0.22, 0.22, 0.22], pal[3], { emissive: pal[3] }));
  return p;
}

function marketParts(): WonderPart[] {
  const p: WonderPart[] = [];
  const colors = ["#ffd76e", "#14f195", "#7dcfe8", "#ffb45e", "#9945ff"];
  p.push(cyl([0, 0.28, 0], [0.54, 0.36, 0.54], "#c79337"));
  p.push(sphere([0, 0.66, 0], [0.24, 0.24, 0.24], "#ffd76e", { emissive: "#5a400f" }));
  let i = 0;
  for (const x of [-1.65, 1.65]) for (const z of [-1.3, 0, 1.3]) {
    const c = colors[i++ % colors.length];
    p.push(box([x, 0.22, z], [0.52, 0.34, 0.38], "#6d4323"));
    p.push(cone([x, 0.58, z], [0.62, 0.36, 0.48], c));
    p.push(box([x, 0.42, z - 0.23], [0.34, 0.10, 0.035], "#f3ead7"));
  }
  return p;
}

function templeParts(): WonderPart[] {
  const stone = "#f3ead7", gold = "#ffd76e", dark = "#5a4322";
  const p: WonderPart[] = [];
  p.push(box([0, 0.12, 0], [2.0, 0.20, 1.25], dark));
  p.push(box([0, 0.30, -0.72], [1.62, 0.12, 0.34], gold));
  for (const x of [-0.75, -0.25, 0.25, 0.75]) p.push(cyl([x, 0.78, -0.15], [0.10, 0.90, 0.10], stone));
  p.push(box([0, 1.28, -0.15], [1.85, 0.20, 0.76], stone));
  p.push(cone([0, 1.66, -0.15], [1.08, 0.58, 0.80], gold));
  p.push(oct([0, 1.98, -0.15], [0.26, 0.26, 0.26], gold, { emissive: "#5a400f" }));
  p.push(box([0, 0.48, 0.48], [0.46, 0.42, 0.30], gold));
  return p;
}

function observatoryParts(): WonderPart[] {
  const p: WonderPart[] = [];
  const base = "#f3ead7", dome = "#31507d", sky = "#7dcfe8", violet = "#9945ff";
  p.push(cyl([0, 0.46, 0], [0.92, 0.84, 0.92], base));
  p.push(sphere([0, 1.08, 0], [0.76, 0.48, 0.76], dome, { metalness: 0.12, roughness: 0.5 }));
  p.push(cyl([0.55, 1.36, -0.55], [0.10, 0.74, 0.10], sky, { rot: [0.78, 0.2, -0.72], emissive: "#183640" }));
  p.push(sphere([0.88, 1.68, -0.88], [0.18, 0.18, 0.18], sky, { emissive: sky }));
  for (const [x, z] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]) p.push(oct([x, 0.42, z], [0.18, 0.18, 0.18], violet, { emissive: violet }));
  p.push(box([0, 0.14, -1.05], [0.92, 0.10, 0.28], base));
  return p;
}

function partsFor(id: WonderTemplateId): WonderPart[] {
  if (id === "skyscraper") return skyscraperParts();
  if (id === "academy") return academyParts();
  if (id === "market") return marketParts();
  if (id === "temple") return templeParts();
  if (id === "observatory") return observatoryParts();
  return schoolParts();
}

function templateMeta(id: any): TemplateMeta {
  return WONDER_TEMPLATES.find((t) => t.id === id) || WONDER_TEMPLATES[0];
}

export function listWonderTemplates() {
  return WONDER_TEMPLATES.map((t) => ({ ...t }));
}

export function buildWonderTemplateRecipe(id: any = "school", opts: any = {}): WonderRecipe {
  const meta = templateMeta(id);
  const prompt = cleanWonderPrompt(opts.prompt || meta.prompt);
  const footprint = normalizeWonderFootprint(opts.footprint || meta.footprint);
  const mode = normalizeWonderMode(opts.mode || meta.mode);
  const paletteId = normalizeWonderPaletteId(opts.paletteId || meta.paletteId);
  const palette = wonderPaletteColors(paletteId);
  const recipe: WonderRecipe = {
    v: WORLD_WONDER_SCHEMA_VERSION,
    name: String(opts.name || meta.name).replace(/[<>`{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 42) || meta.name,
    prompt,
    palette,
    aura: paletteId === "arcane" || paletteId === "royal" ? "violet" : paletteId === "frost" ? "blue" : paletteId === "emerald" ? "mint" : "gold",
    parts: partsFor(meta.id),
    footprint,
    mode,
    paletteId,
    buildMs: wonderBuildMsFor({ footprint, mode }),
  };
  return applyWonderDesignOptions(recipe, { prompt, name: opts.name || meta.name, footprint, mode, paletteId, palette });
}
