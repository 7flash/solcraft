export type PrismRecipePart = {
  id: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  top: string;
  left?: string;
  right?: string;
};

export type BuildingRecipeOptions = {
  color?: string;
  plinth?: string;
  name?: string;
  buildProgress?: number;
};

function cssHex(value: any, fallback: string) {
  const s = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}

function part(id: string, x: number, z: number, y: number, w: number, d: number, h: number, top: string, left?: string, right?: string): PrismRecipePart {
  return { id, x, z, y, w, d, h, top, left, right };
}

const FOUNDATION_SHADOW = "#26362c";
const FOUNDATION_STONE_TOP = "#756b4b";
const FOUNDATION_STONE_LEFT = "#5e553b";
const FOUNDATION_STONE_RIGHT = "#49422f";
const FOUNDATION_LIP_TOP = "#9a8754";
const FOUNDATION_LIP_LEFT = "#74633e";
const FOUNDATION_LIP_RIGHT = "#54472f";

function baseParts(plinth: string, footprint = 0.94): PrismRecipePart[] {
  // next11: foundations should read as construction, not as claimed terrain.
  // Every building gets a neutral stone apron plus a warm lip before its custom
  // body color starts. That creates a clear silhouette in dense capital clusters
  // and prevents top faces from visually melting into green/sand floor tiles.
  const localPlinth = cssHex(plinth, FOUNDATION_STONE_TOP);
  return [
    part("ground-shadow", 0, 0, 0.012, footprint + 0.08, footprint * 0.76, 0.018, FOUNDATION_SHADOW, "#203027", "#19241d"),
    part("foundation-apron", 0, 0.006, 0.045, footprint + 0.04, footprint * 0.78, 0.070, FOUNDATION_STONE_TOP, FOUNDATION_STONE_LEFT, FOUNDATION_STONE_RIGHT),
    part("foundation", 0, 0, 0.105, footprint * 0.90, footprint * 0.70, 0.082, localPlinth, FOUNDATION_STONE_LEFT, FOUNDATION_STONE_RIGHT),
    part("foundation-lip", 0, 0.018, 0.182, footprint * 0.74, footprint * 0.55, 0.044, FOUNDATION_LIP_TOP, FOUNDATION_LIP_LEFT, FOUNDATION_LIP_RIGHT),
  ];
}

function roofStack(prefix: string, y: number, color: string, wide = 0.78, deep = 0.56): PrismRecipePart[] {
  return [
    part(`${prefix}-roof-a`, 0, -0.025, y, wide, deep, 0.115, color),
    part(`${prefix}-roof-b`, 0, -0.045, y + 0.105, wide * 0.76, deep * 0.72, 0.100, color),
    part(`${prefix}-roof-c`, 0, -0.060, y + 0.198, wide * 0.50, deep * 0.48, 0.080, color),
  ];
}

function flag(prefix: string, x: number, z: number, y: number, color = "#2f68d8"): PrismRecipePart[] {
  return [
    part(`${prefix}-flag-pole`, x, z, y, 0.035, 0.035, 0.42, "#2e2419"),
    part(`${prefix}-flag-cloth`, x + 0.13, z - 0.015, y + 0.25, 0.24, 0.028, 0.13, color),
  ];
}

function house(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 0.98),
    part("body", 0, 0, 0.18, 0.66, 0.48, 0.42, "#ead8aa", "#c9b274", "#a78f58"),
    part("door", 0, 0.252, 0.23, 0.16, 0.045, 0.24, "#4b2d1d", "#3b2114", "#28150d"),
    part("window-l", -0.22, -0.255, 0.37, 0.12, 0.045, 0.10, "#9bd7e3", "#68a8b8", "#4f8492"),
    part("window-r", 0.22, -0.255, 0.37, 0.12, 0.045, 0.10, "#9bd7e3", "#68a8b8", "#4f8492"),
    part("trim", 0, 0.005, 0.595, 0.72, 0.54, 0.045, color),
    ...roofStack("main", 0.64, "#8d5230", 0.88, 0.62),
    part("chimney", 0.27, 0.12, 0.78, 0.10, 0.10, 0.28, "#5c3622", "#432516", "#2d180e"),
  ];
}

function market(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.04),
    part("counter", 0, 0.06, 0.18, 0.82, 0.42, 0.22, "#c79337"),
    part("stall-l", -0.27, -0.08, 0.40, 0.32, 0.28, 0.30, color),
    part("stall-r", 0.27, -0.08, 0.40, 0.32, 0.28, 0.30, "#7dcfe8"),
    part("stall-back", 0, 0.22, 0.39, 0.50, 0.16, 0.26, "#f6e7c8"),
    part("awning-l", -0.26, -0.09, 0.74, 0.38, 0.32, 0.08, "#f6e7c8"),
    part("awning-r", 0.26, -0.09, 0.74, 0.38, 0.32, 0.08, color),
    ...flag("market", 0.39, -0.20, 0.72, "#ceb443"),
  ];
}

function gateTower(color: string, plinth: string, id = "gate"): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.02),
    part(`${id}-body-low`, 0, 0, 0.20, 0.52, 0.52, 0.66, color, "#8f3025", "#6d2119"),
    part(`${id}-body-mid`, 0, 0, 0.84, 0.44, 0.44, 0.56, color, "#9c362b", "#76241c"),
    part(`${id}-ring-low`, 0, 0, 0.68, 0.66, 0.62, 0.075, "#51432b", "#3f3524", "#2f281c"),
    part(`${id}-ring-top`, 0, 0, 1.34, 0.60, 0.56, 0.085, "#5b492d", "#443725", "#332b1f"),
    part(`${id}-roof-base`, 0, 0, 1.47, 0.64, 0.60, 0.14, "#c44732"),
    part(`${id}-roof-mid`, 0, -0.01, 1.60, 0.46, 0.42, 0.14, "#d5523a"),
    part(`${id}-roof-tip`, 0, -0.02, 1.73, 0.26, 0.24, 0.12, "#ef6a4b"),
    ...flag(id, 0.23, -0.15, 1.78, "#245edb"),
  ];
}

function bank(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.08),
    part("stone-core", 0, 0, 0.18, 0.72, 0.54, 0.52, "#d7dfcf", "#aeb7ad", "#7e8a80"),
    part("vault-door", 0, 0.295, 0.28, 0.24, 0.052, 0.28, "#222f42", "#172232", "#101722"),
    part("brass-band", 0, 0.02, 0.67, 0.82, 0.62, 0.075, "#ceb443", "#987f24", "#6d5918"),
    part("upper", 0, -0.01, 0.75, 0.58, 0.42, 0.30, "#f3ead7", "#c2b596", "#94886f"),
    part("cap", 0, -0.025, 1.04, 0.70, 0.52, 0.13, color),
    part("gem", 0.28, -0.18, 1.17, 0.12, 0.08, 0.10, "#14f195", "#0d8f64", "#096144"),
  ];
}

function hall(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.16),
    part("hall-body", 0, 0, 0.18, 0.88, 0.64, 0.54, "#d8c796", "#aa935f", "#7f6a42"),
    part("entry", 0, 0.36, 0.24, 0.30, 0.06, 0.32, "#392319"),
    part("left-wing", -0.44, 0.02, 0.22, 0.24, 0.48, 0.42, "#b6a66f"),
    part("right-wing", 0.44, 0.02, 0.22, 0.24, 0.48, 0.42, "#b6a66f"),
    ...roofStack("hall", 0.70, color, 1.04, 0.72),
    part("bell", 0, -0.16, 1.02, 0.22, 0.18, 0.24, "#ceb443", "#987f24", "#6d5918"),
    ...flag("hall", 0.42, -0.24, 1.05, "#245edb"),
  ];
}

function workshop(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.00),
    part("body", 0, 0, 0.18, 0.74, 0.54, 0.42, "#7b4f32", "#5b3520", "#3f2517"),
    part("forge", -0.22, 0.20, 0.32, 0.24, 0.18, 0.28, "#d6604f", "#9a372f", "#66241e"),
    part("anvil", 0.22, 0.16, 0.30, 0.24, 0.16, 0.18, "#82979e", "#59676d", "#3f4a50"),
    ...roofStack("workshop", 0.58, "#2f2a20", 0.86, 0.62),
    part("spark", -0.32, 0.05, 0.78, 0.08, 0.08, 0.08, "#ffd76e"),
  ];
}

function quarry(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.02),
    part("pit", 0, 0, 0.17, 0.76, 0.56, 0.18, "#5f6a72", "#414b52", "#30383e"),
    part("rock-a", -0.20, -0.12, 0.34, 0.44, 0.34, 0.34, "#cfd6dc", "#8d98a3", "#68737d"),
    part("rock-b", 0.24, 0.14, 0.31, 0.36, 0.30, 0.27, "#aab3bb", "#7d8790", "#59636c"),
    part("crane-base", 0.32, -0.22, 0.38, 0.12, 0.12, 0.54, "#6d4a2b"),
    part("crane-arm", 0.12, -0.22, 0.87, 0.46, 0.08, 0.08, "#8b5628"),
  ];
}

function lumber(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.02),
    part("shed", -0.18, 0.04, 0.18, 0.46, 0.40, 0.30, "#8b5628"),
    ...roofStack("shed", 0.47, "#4d321e", 0.56, 0.44),
    part("log-a", 0.20, -0.18, 0.22, 0.58, 0.08, 0.10, "#a66a35", "#7e4c24", "#5f371a"),
    part("log-b", 0.23, 0.00, 0.30, 0.52, 0.08, 0.10, "#b87940", "#8a542c", "#663d20"),
    part("log-c", 0.15, 0.18, 0.38, 0.42, 0.08, 0.10, "#9c612f", "#74451f", "#553216"),
    part("saw", 0.35, 0.16, 0.50, 0.18, 0.04, 0.20, "#d7dfcf"),
  ];
}

function farm(color: string, plinth: string): PrismRecipePart[] {
  const rows: PrismRecipePart[] = [...baseParts(plinth, 1.02), part("soil", 0, 0, 0.16, 0.82, 0.58, 0.08, "#6d4a2b")];
  [-0.30, -0.10, 0.10, 0.30].forEach((x, i) => rows.push(part(`crop-${i}`, x, 0, 0.24, 0.08, 0.48, 0.26 + i * 0.02, i % 2 ? "#ffd76e" : "#3faa55")));
  rows.push(part("scarecrow", 0.36, -0.22, 0.24, 0.08, 0.08, 0.46, "#8b5628"));
  rows.push(part("scarecrow-hat", 0.36, -0.22, 0.68, 0.22, 0.16, 0.08, "#ceb443"));
  return rows;
}

function warehouse(color: string, plinth: string): PrismRecipePart[] {
  const rows: PrismRecipePart[] = [...baseParts(plinth, 1.12), part("body", 0, 0, 0.18, 0.86, 0.64, 0.60, "#b78652")];
  rows.push(...roofStack("warehouse", 0.76, "#6f4a2b", 1.02, 0.74));
  [-0.28, 0, 0.28].forEach((x, i) => rows.push(part(`crate-${i}`, x, 0.32, 0.26 + i * 0.03, 0.18, 0.10, 0.20, "#342018")));
  return rows;
}

function wonder(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.24),
    part("wonder-core-a", 0, 0, 0.20, 0.52, 0.52, 0.82, color),
    part("wonder-core-b", 0, 0, 0.98, 0.40, 0.40, 0.68, "#ceb443", "#987f24", "#6d5918"),
    part("wonder-ring-a", 0, 0, 0.72, 0.86, 0.18, 0.10, "#f3ead7"),
    part("wonder-ring-b", 0, 0, 1.34, 0.18, 0.86, 0.10, "#7dcfe8"),
    part("wonder-tip", 0, 0, 1.66, 0.26, 0.26, 0.40, "#fff0a8"),
    ...flag("wonder", 0.34, -0.24, 1.82, "#9945ff"),
  ];
}

function generic(color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 0.98),
    part("body", 0, 0, 0.18, 0.72, 0.52, 0.46, color),
    ...roofStack("generic", 0.60, "#b8873e", 0.66, 0.48),
  ];
}

export function buildingRecipeFor(kind: string, opts: BuildingRecipeOptions = {}): PrismRecipePart[] {
  const k = String(kind || "building").toLowerCase();
  const color = cssHex(opts.color, "#d6604f");
  const plinth = cssHex(opts.plinth, "#3f3920");

  if (k === "cottage" || k === "house") return house(color, plinth);
  if (k === "market" || k === "tradepost") return market(color, plinth);
  if (k === "townhall" || k === "guidehall" || k === "academy") return hall(color, plinth);
  if (k === "vault" || k === "bank" || k === "goldmine") return bank(color, plinth);
  if (k === "workshop" || k === "forge" || k === "alchemy") return workshop(color, plinth);
  if (k === "quarry") return quarry(color, plinth);
  if (k === "lumber" || k === "sawmill") return lumber(color, plinth);
  if (k === "farm" || k === "granary" || k === "windmill") return farm(color, plinth);
  if (k === "warehouse" || k === "barracks" || k === "tavern") return warehouse(color, plinth);
  if (k === "keep" || k === "watchtower" || k === "northgate" || k === "eastgate" || k === "barbcamp") return gateTower(color, plinth, k);
  if (k === "worldwonder" || k === "obelisk" || k === "statue" || k === "crystal" || k === "shrine") return wonder(color, plinth);
  if (k === "well" || k === "fountain" || k === "pond" || k === "waterfall") return [
    ...baseParts(plinth, 0.90),
    part("water", 0, 0, 0.18, 0.58, 0.42, 0.12, "#7dcfe8", "#3e9fb5", "#2b7181"),
    part("rim", 0, 0, 0.30, 0.70, 0.54, 0.08, "#d7dfcf"),
  ];
  if (k === "garden" || k === "flowerbed" || k === "hedge" || k === "bench" || k === "lantern" || k === "campfire" || k === "arch" || k === "signpost") return [
    ...baseParts(plinth, 0.84),
    part("decor-a", -0.16, -0.06, 0.18, 0.22, 0.18, 0.24, "#2f952f"),
    part("decor-b", 0.18, 0.08, 0.18, 0.18, 0.16, 0.18, color),
    part("decor-c", 0.00, 0.20, 0.18, 0.38, 0.08, 0.10, "#ceb443"),
  ];
  if (k === "bomb") return [
    ...baseParts(plinth, 0.72),
    part("bomb-body", 0, 0, 0.17, 0.42, 0.36, 0.32, "#594134"),
    part("bomb-fuse", 0, -0.02, 0.46, 0.24, 0.18, 0.24, "#ff7a66"),
  ];
  return generic(color, plinth);
}

export function recipeVisibleParts(parts: PrismRecipePart[], progress = 1): PrismRecipePart[] {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  if (p >= 0.995) return parts;
  const visible = Math.max(1, Math.ceil(parts.length * Math.max(0.10, p)));
  return parts.slice(0, visible);
}
