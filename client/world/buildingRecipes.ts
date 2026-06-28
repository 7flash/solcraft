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
  /** Optional procedural lit-window grid drawn by the canvas renderer. */
  windows?: { cols?: number; rows?: number; glow?: boolean; face?: "left" | "right" | "both" };
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

function rgb(hex: string) {
  const h = cssHex(hex, "#000000").slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const;
}

function hexFromRgb(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function shade(hex: string, amount: number) {
  const [r, g, b] = rgb(hex);
  const t = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return hexFromRgb(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}

function isTerrainGreenish(hex: string) {
  const [r, g, b] = rgb(hex);
  return g > r * 1.08 && g > b * 1.04 && g < 150 && r < 120 && b < 130;
}

function part(id: string, x: number, z: number, y: number, w: number, d: number, h: number, top: string, left?: string, right?: string): PrismRecipePart {
  return { id, x, z, y, w, d, h, top, left, right };
}

function win(p: PrismRecipePart, cols = 2, rows = 2, glow = true, face: "left" | "right" | "both" = "both"): PrismRecipePart {
  return { ...p, windows: { cols, rows, glow, face } };
}

// next12 material rule:
// Building top faces must never be the same visual material as the terrain.  Owned
// colors may still appear as small flags/gems/trim, but bases, caps, and roofs use
// a stable architecture palette: warm stone, brass, red lacquer, slate, and minted
// oxidized copper.  This mirrors the reference canvas demo's separation between
// ground material and stacked prism buildings.
const MAT = {
  shadow: "#192018",
  stoneTop: "#8f7b53",
  stoneLeft: "#6d5a38",
  stoneRight: "#4f3f28",
  lipTop: "#c59a45",
  lipLeft: "#8e692f",
  lipRight: "#624820",
  creamTop: "#e8d8ad",
  creamLeft: "#bda46f",
  creamRight: "#8b7248",
  brassTop: "#e2b64d",
  brassLeft: "#a47a25",
  brassRight: "#735317",
  redTop: "#c94a34",
  redLeft: "#8f2d24",
  redRight: "#5e1d18",
  darkRedTop: "#8f241d",
  darkRedLeft: "#661713",
  darkRedRight: "#430f0d",
  slateTop: "#9aa5a1",
  slateLeft: "#697771",
  slateRight: "#4a5752",
  mintTop: "#b7e9d3",
  mintLeft: "#78b99a",
  mintRight: "#4f846c",
  umberTop: "#a66a35",
  umberLeft: "#704321",
  umberRight: "#4b2b16",
  blueTop: "#3d6fd8",
  blueLeft: "#244a9d",
  blueRight: "#17316a",
  violetTop: "#7b43c7",
  violetLeft: "#4d267f",
  violetRight: "#321855",
};

function safePlinth(plinth: any) {
  const raw = cssHex(plinth, MAT.stoneTop);
  return isTerrainGreenish(raw) ? MAT.stoneTop : raw;
}

function baseParts(plinth: string, footprint = 0.94): PrismRecipePart[] {
  const localPlinth = safePlinth(plinth);
  return [
    part("ground-shadow", 0, 0, 0.012, footprint + 0.10, footprint * 0.78, 0.018, MAT.shadow, "#151c15", "#101610"),
    part("foundation-apron", 0, 0.006, 0.045, footprint + 0.05, footprint * 0.80, 0.074, MAT.stoneTop, MAT.stoneLeft, MAT.stoneRight),
    part("foundation-core", 0, 0, 0.116, footprint * 0.92, footprint * 0.72, 0.086, localPlinth, shade(localPlinth, -0.24), shade(localPlinth, -0.36)),
    part("foundation-brass-lip", 0, 0.018, 0.198, footprint * 0.78, footprint * 0.58, 0.052, MAT.lipTop, MAT.lipLeft, MAT.lipRight),
  ];
}

function roofStack(prefix: string, y: number, top: string, left?: string, right?: string, wide = 0.78, deep = 0.56): PrismRecipePart[] {
  return [
    part(`${prefix}-roof-a`, 0, -0.025, y, wide, deep, 0.120, top, left, right),
    part(`${prefix}-roof-b`, 0, -0.045, y + 0.110, wide * 0.76, deep * 0.72, 0.105, shade(top, 0.06), left, right),
    part(`${prefix}-roof-c`, 0, -0.060, y + 0.208, wide * 0.50, deep * 0.48, 0.084, shade(top, 0.10), left, right),
  ];
}

function flag(prefix: string, x: number, z: number, y: number, color = MAT.blueTop): PrismRecipePart[] {
  const cloth = isTerrainGreenish(color) ? MAT.blueTop : cssHex(color, MAT.blueTop);
  return [
    part(`${prefix}-flag-pole`, x, z, y, 0.035, 0.035, 0.42, "#332318", "#23170f", "#17100b"),
    part(`${prefix}-flag-cloth`, x + 0.13, z - 0.015, y + 0.25, 0.24, 0.028, 0.13, cloth, shade(cloth, -0.22), shade(cloth, -0.34)),
  ];
}

function accentForKind(k: string, raw: any) {
  const color = cssHex(raw, MAT.redTop);
  if (k.includes("gate") || k === "keep" || k === "watchtower" || k === "barbcamp") return MAT.redTop;
  if (k === "bank" || k === "vault" || k === "goldmine") return MAT.mintTop;
  if (k === "townhall" || k === "academy" || k === "guidehall") return MAT.brassTop;
  if (k === "market" || k === "tradepost") return MAT.violetTop;
  if (k === "farm" || k === "granary" || k === "windmill") return MAT.mintTop;
  if (k === "lumber" || k === "sawmill" || k === "warehouse" || k === "tavern") return MAT.umberTop;
  if (k === "quarry") return MAT.slateTop;
  if (k === "workshop" || k === "forge" || k === "alchemy") return "#a86a38";
  if (k === "worldwonder" || k === "obelisk" || k === "statue" || k === "crystal" || k === "shrine") return MAT.brassTop;
  return isTerrainGreenish(color) ? MAT.redTop : color;
}

function house(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 0.98),
    win(part("body", 0, 0, 0.22, 0.72, 0.54, 0.62, MAT.creamTop, MAT.creamLeft, MAT.creamRight), 2, 2),
    part("door", 0, 0.255, 0.28, 0.16, 0.048, 0.24, "#4b2d1d", "#3b2114", "#28150d"),
    part("window-l", -0.22, -0.255, 0.40, 0.12, 0.045, 0.10, "#8bd8e1", "#4f9dac", "#37717d"),
    part("window-r", 0.22, -0.255, 0.40, 0.12, 0.045, 0.10, "#8bd8e1", "#4f9dac", "#37717d"),
    part("body-brass-trim", 0, 0.005, 0.642, 0.76, 0.56, 0.055, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...roofStack("main", 0.700, MAT.redTop, MAT.redLeft, MAT.redRight, 0.90, 0.64),
    part("roof-inset", 0, -0.058, 0.985, 0.36, 0.30, 0.045, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    part("chimney", 0.27, 0.12, 0.83, 0.10, 0.10, 0.28, "#5c3622", "#432516", "#2d180e"),
  ];
}

function market(color: string, plinth: string): PrismRecipePart[] {
  const accent = isTerrainGreenish(color) ? MAT.violetTop : color;
  return [
    ...baseParts(plinth, 1.06),
    part("counter", 0, 0.06, 0.22, 0.84, 0.44, 0.24, MAT.umberTop, MAT.umberLeft, MAT.umberRight),
    part("stall-l", -0.27, -0.08, 0.45, 0.32, 0.28, 0.30, accent, shade(accent, -0.26), shade(accent, -0.38)),
    part("stall-r", 0.27, -0.08, 0.45, 0.32, 0.28, 0.30, "#53adc0", "#327b89", "#22535d"),
    part("stall-back", 0, 0.22, 0.44, 0.50, 0.16, 0.26, MAT.creamTop, MAT.creamLeft, MAT.creamRight),
    part("awning-brass", 0, -0.09, 0.775, 0.90, 0.36, 0.075, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part("awning-accent-l", -0.24, -0.09, 0.855, 0.34, 0.30, 0.07, MAT.creamTop, MAT.creamLeft, MAT.creamRight),
    part("awning-accent-r", 0.24, -0.09, 0.855, 0.34, 0.30, 0.07, accent, shade(accent, -0.24), shade(accent, -0.36)),
    ...flag("market", 0.39, -0.20, 0.82, "#d79b2d"),
  ];
}

function gateTower(_color: string, plinth: string, id = "gate"): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.04),
    win(part(`${id}-body-low`, 0, 0, 0.23, 0.64, 0.64, 0.98, MAT.darkRedTop, MAT.darkRedLeft, MAT.darkRedRight), 2, 3),
    win(part(`${id}-body-mid`, 0, 0, 1.16, 0.52, 0.52, 0.72, "#a52b22", "#761c17", "#50110e"), 2, 3),
    part(`${id}-brass-ring-low`, 0, 0, 0.74, 0.70, 0.66, 0.080, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part(`${id}-brass-ring-top`, 0, 0, 1.405, 0.64, 0.60, 0.090, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part(`${id}-roof-base`, 0, 0, 1.535, 0.66, 0.62, 0.145, MAT.redTop, MAT.redLeft, MAT.redRight),
    part(`${id}-roof-mid`, 0, -0.01, 1.670, 0.48, 0.44, 0.145, shade(MAT.redTop, 0.08), MAT.redLeft, MAT.redRight),
    part(`${id}-roof-tip`, 0, -0.02, 1.805, 0.28, 0.26, 0.12, shade(MAT.redTop, 0.14), MAT.redLeft, MAT.redRight),
    part(`${id}-roof-slate-inset`, 0, -0.035, 1.925, 0.16, 0.14, 0.040, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    ...flag(id, 0.23, -0.15, 1.92, MAT.blueTop),
  ];
}

function bank(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.10),
    win(part("stone-core", 0, 0, 0.22, 0.84, 0.62, 0.82, "#c9c6ae", "#928d76", "#68634f"), 3, 3),
    part("vault-door", 0, 0.305, 0.34, 0.25, 0.052, 0.29, "#222f42", "#172232", "#101722"),
    part("brass-band", 0, 0.02, 0.715, 0.86, 0.64, 0.085, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    win(part("upper", 0, -0.01, 1.045, 0.64, 0.46, 0.46, MAT.creamTop, MAT.creamLeft, MAT.creamRight), 2, 2),
    part("light-roof-plate", 0, -0.025, 1.105, 0.72, 0.54, 0.12, "#c7d8c8", "#879b85", "#607260"),
    part("brass-cap-lip", 0, -0.030, 1.230, 0.52, 0.39, 0.060, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part("gem", 0.28, -0.18, 1.28, 0.12, 0.08, 0.10, "#7fffd2", "#31a57a", "#1d6b4e"),
  ];
}

function hall(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.18),
    win(part("hall-body", 0, 0, 0.22, 0.98, 0.72, 0.86, "#b9854a", "#82582f", "#5a3a20"), 4, 3),
    part("entry", 0, 0.37, 0.31, 0.30, 0.06, 0.34, "#392319", "#24150d", "#160c07"),
    part("left-wing", -0.44, 0.02, 0.27, 0.24, 0.50, 0.42, "#d0b46a", "#9b7940", "#6e542e"),
    part("right-wing", 0.44, 0.02, 0.27, 0.24, 0.50, 0.42, "#d0b46a", "#9b7940", "#6e542e"),
    part("brass-roof-lip", 0, 0, 0.755, 1.08, 0.76, 0.09, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...roofStack("hall", 0.835, MAT.brassTop, MAT.brassLeft, MAT.brassRight, 1.00, 0.70),
    part("roof-inset-slate", 0, -0.07, 1.140, 0.42, 0.32, 0.06, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    part("bell", 0, -0.16, 1.18, 0.22, 0.18, 0.24, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...flag("hall", 0.42, -0.24, 1.20, MAT.blueTop),
  ];
}

function workshop(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.02),
    win(part("body", 0, 0, 0.22, 0.84, 0.62, 0.64, MAT.umberTop, MAT.umberLeft, MAT.umberRight), 2, 2),
    part("forge", -0.22, 0.20, 0.36, 0.24, 0.18, 0.28, MAT.redTop, MAT.redLeft, MAT.redRight),
    part("anvil", 0.22, 0.16, 0.34, 0.24, 0.16, 0.18, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    part("roof-lip", 0, 0, 0.615, 0.90, 0.66, 0.075, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...roofStack("workshop", 0.690, "#4a3424", "#312116", "#21150e", 0.86, 0.62),
    part("spark", -0.32, 0.05, 0.90, 0.08, 0.08, 0.08, "#ffd76e"),
  ];
}

function quarry(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.02),
    part("pit", 0, 0, 0.20, 0.76, 0.56, 0.18, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    part("rock-a", -0.20, -0.12, 0.38, 0.44, 0.34, 0.34, "#cfd6dc", "#8d98a3", "#68737d"),
    part("rock-b", 0.24, 0.14, 0.35, 0.36, 0.30, 0.27, "#aab3bb", "#7d8790", "#59636c"),
    part("crane-base", 0.32, -0.22, 0.42, 0.12, 0.12, 0.54, MAT.umberTop, MAT.umberLeft, MAT.umberRight),
    part("crane-arm", 0.12, -0.22, 0.91, 0.46, 0.08, 0.08, "#ba7a35", "#86501f", "#5f3716"),
  ];
}

function lumber(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.02),
    part("shed", -0.18, 0.04, 0.22, 0.46, 0.40, 0.30, MAT.umberTop, MAT.umberLeft, MAT.umberRight),
    part("shed-lip", -0.18, 0.04, 0.50, 0.58, 0.46, 0.06, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...roofStack("shed", 0.560, "#5b3a22", "#3f2818", "#2c1a0f", 0.56, 0.44),
    part("log-a", 0.20, -0.18, 0.26, 0.58, 0.08, 0.10, "#bd793e", "#86502a", "#5f371e"),
    part("log-b", 0.23, 0.00, 0.34, 0.52, 0.08, 0.10, "#c9894b", "#935a30", "#6b3f22"),
    part("log-c", 0.15, 0.18, 0.42, 0.42, 0.08, 0.10, "#a96a35", "#794822", "#563116"),
    part("saw", 0.35, 0.16, 0.54, 0.18, 0.04, 0.20, "#d7dfcf"),
  ];
}

function farm(_color: string, plinth: string): PrismRecipePart[] {
  const rows: PrismRecipePart[] = [...baseParts(plinth, 1.02), part("soil", 0, 0, 0.20, 0.82, 0.58, 0.08, "#73512e", "#4f351e", "#352313")];
  [-0.30, -0.10, 0.10, 0.30].forEach((x, i) => rows.push(part(`crop-${i}`, x, 0, 0.29, 0.08, 0.48, 0.26 + i * 0.02, i % 2 ? "#ffd76e" : "#54c96d", i % 2 ? "#a98728" : "#2d8742", i % 2 ? "#755d1a" : "#1d5a2b")));
  rows.push(part("scarecrow", 0.36, -0.22, 0.28, 0.08, 0.08, 0.46, MAT.umberTop, MAT.umberLeft, MAT.umberRight));
  rows.push(part("scarecrow-hat", 0.36, -0.22, 0.72, 0.22, 0.16, 0.08, MAT.brassTop, MAT.brassLeft, MAT.brassRight));
  return rows;
}

function warehouse(_color: string, plinth: string): PrismRecipePart[] {
  const rows: PrismRecipePart[] = [...baseParts(plinth, 1.18), win(part("body", 0, 0, 0.22, 0.96, 0.72, 0.88, "#b78652", "#80522d", "#5b3820"), 3, 3)];
  rows.push(part("rib-lip", 0, 0, 0.79, 0.98, 0.72, 0.075, MAT.brassTop, MAT.brassLeft, MAT.brassRight));
  rows.push(...roofStack("warehouse", 0.860, "#7f5632", "#56371f", "#3a2414", 1.02, 0.74));
  [-0.28, 0, 0.28].forEach((x, i) => rows.push(part(`crate-${i}`, x, 0.32, 0.30 + i * 0.03, 0.18, 0.10, 0.20, "#3b2418", "#26170f", "#180d08")));
  return rows;
}

function wonder(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.24),
    part("wonder-core-a", 0, 0, 0.24, 0.52, 0.52, 0.82, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    part("wonder-core-b", 0, 0, 1.02, 0.40, 0.40, 0.68, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part("wonder-ring-a", 0, 0, 0.76, 0.86, 0.18, 0.10, MAT.creamTop, MAT.creamLeft, MAT.creamRight),
    part("wonder-ring-b", 0, 0, 1.38, 0.18, 0.86, 0.10, MAT.mintTop, MAT.mintLeft, MAT.mintRight),
    part("wonder-tip", 0, 0, 1.72, 0.26, 0.26, 0.40, "#fff0a8", "#b99a31", "#80681d"),
    ...flag("wonder", 0.34, -0.24, 1.88, MAT.violetTop),
  ];
}

function cityTower(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.28),
    win(part("tower-lower", 0, 0, 0.24, 0.92, 0.70, 1.42, "#71879b", "#4e6477", "#35495a"), 4, 6),
    part("tower-sky-lobby", 0, 0, 1.61, 1.00, 0.76, 0.13, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    win(part("tower-mid", 0, -0.02, 1.72, 0.74, 0.58, 1.12, "#637a90", "#465b70", "#304252"), 4, 5),
    part("tower-brass-waist", 0, -0.03, 2.78, 0.82, 0.64, 0.12, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    win(part("tower-upper", 0, -0.05, 2.88, 0.56, 0.46, 1.05, "#5c7186", "#405569", "#2c3d4d"), 3, 5),
    part("tower-roof-deck", 0, -0.05, 3.88, 0.70, 0.56, 0.16, MAT.slateTop, MAT.slateLeft, MAT.slateRight),
    part("tower-antenna-base", 0, -0.05, 4.02, 0.22, 0.18, 0.20, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part("tower-antenna", 0, -0.05, 4.22, 0.045, 0.045, 0.80, "#d7dfcf", "#a3ada4", "#747f78"),
    ...flag("tower", 0.24, -0.20, 4.36, MAT.redTop),
  ];
}


function civicBlock(_color: string, plinth: string): PrismRecipePart[] {
  return [
    ...baseParts(plinth, 1.34),
    win(part("civic-podium", 0, 0, 0.24, 1.10, 0.82, 0.70, "#d6c38e", "#9b8150", "#6f5a38"), 5, 2),
    part("civic-steps", 0, 0.43, 0.26, 0.82, 0.16, 0.10, MAT.stoneTop, MAT.stoneLeft, MAT.stoneRight),
    win(part("civic-left-wing", -0.36, -0.02, 0.86, 0.42, 0.58, 0.78, MAT.creamTop, MAT.creamLeft, MAT.creamRight), 2, 3),
    win(part("civic-right-wing", 0.36, -0.02, 0.86, 0.42, 0.58, 0.78, MAT.creamTop, MAT.creamLeft, MAT.creamRight), 2, 3),
    win(part("civic-center-tower", 0, -0.04, 0.92, 0.46, 0.50, 1.34, "#b98a4e", "#825a2e", "#59391f"), 3, 5),
    part("civic-gold-waist", 0, -0.04, 1.58, 1.04, 0.72, 0.10, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...roofStack("civic", 2.22, MAT.brassTop, MAT.brassLeft, MAT.brassRight, 0.78, 0.56),
    part("civic-clock", 0, 0.23, 1.72, 0.18, 0.04, 0.18, "#fff0a8", "#b99a31", "#80681d"),
    ...flag("civic", 0.32, -0.22, 2.54, MAT.blueTop),
  ];
}

function arcadeMarket(color: string, plinth: string): PrismRecipePart[] {
  const accent = isTerrainGreenish(color) ? MAT.violetTop : color;
  const parts: PrismRecipePart[] = [
    ...baseParts(plinth, 1.30),
    win(part("arcade-core", 0, 0, 0.23, 1.04, 0.78, 0.72, MAT.creamTop, MAT.creamLeft, MAT.creamRight), 5, 2),
    part("arcade-left-awning", -0.32, 0.34, 0.58, 0.38, 0.18, 0.16, accent, shade(accent, -0.24), shade(accent, -0.36)),
    part("arcade-mid-awning", 0, 0.34, 0.60, 0.38, 0.18, 0.18, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    part("arcade-right-awning", 0.32, 0.34, 0.58, 0.38, 0.18, 0.16, "#53adc0", "#327b89", "#22535d"),
    part("arcade-upper-deck", 0, -0.02, 0.93, 0.92, 0.64, 0.32, "#b9854a", "#82582f", "#5a3a20"),
    part("arcade-sign", 0, 0.43, 1.02, 0.42, 0.05, 0.18, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
    ...roofStack("arcade", 1.24, accent, shade(accent, -0.24), shade(accent, -0.36), 1.02, 0.70),
  ];
  [-0.42, -0.14, 0.14, 0.42].forEach((x, i) => parts.push(part(`arcade-lamp-${i}`, x, 0.44, 0.48, 0.07, 0.05, 0.18, "#ffd76e", "#a98728", "#755d1a")));
  return parts;
}

function generic(color: string, plinth: string): PrismRecipePart[] {
  const accent = isTerrainGreenish(color) ? MAT.redTop : color;
  return [
    ...baseParts(plinth, 0.98),
    win(part("body", 0, 0, 0.22, 0.80, 0.58, 0.72, MAT.creamTop, MAT.creamLeft, MAT.creamRight), 2, 3),
    part("accent-band", 0, 0, 0.665, 0.78, 0.58, 0.065, accent, shade(accent, -0.26), shade(accent, -0.38)),
    ...roofStack("generic", 0.730, MAT.brassTop, MAT.brassLeft, MAT.brassRight, 0.66, 0.48),
  ];
}

export function buildingRecipeFor(kind: string, opts: BuildingRecipeOptions = {}): PrismRecipePart[] {
  const k = String(kind || "building").toLowerCase();
  const accent = accentForKind(k, opts.color);
  const plinth = safePlinth(opts.plinth);

  if (k === "cottage" || k === "house") return house(accent, plinth);
  if (k === "tower" || k === "skyscraper" || k === "highrise" || k === "citytower" || k === "apartment") return cityTower(accent, plinth);
  if (k === "market" || k === "tradepost") return market(accent, plinth);
  if (k === "mall" || k === "arcade" || k === "exchange") return arcadeMarket(accent, plinth);
  if (k === "townhall" || k === "guidehall" || k === "academy") return civicBlock(accent, plinth);
  if (k === "vault" || k === "bank" || k === "goldmine") return bank(accent, plinth);
  if (k === "workshop" || k === "forge" || k === "alchemy") return workshop(accent, plinth);
  if (k === "quarry") return quarry(accent, plinth);
  if (k === "lumber" || k === "sawmill") return lumber(accent, plinth);
  if (k === "farm" || k === "granary" || k === "windmill") return farm(accent, plinth);
  if (k === "warehouse" || k === "barracks" || k === "tavern") return warehouse(accent, plinth);
  if (k === "keep" || k === "watchtower" || k === "northgate" || k === "eastgate" || k === "barbcamp") return gateTower(accent, plinth, k);
  if (k === "worldwonder" || k === "obelisk" || k === "statue" || k === "crystal" || k === "shrine") return wonder(accent, plinth);
  if (k === "well" || k === "fountain" || k === "pond" || k === "waterfall") return [
    ...baseParts(plinth, 0.90),
    part("water", 0, 0, 0.22, 0.58, 0.42, 0.12, "#7dcfe8", "#3e9fb5", "#2b7181"),
    part("rim", 0, 0, 0.34, 0.70, 0.54, 0.08, MAT.creamTop, MAT.creamLeft, MAT.creamRight),
  ];
  if (k === "garden" || k === "flowerbed" || k === "hedge" || k === "bench" || k === "lantern" || k === "campfire" || k === "arch" || k === "signpost") return [
    ...baseParts(plinth, 0.84),
    part("decor-a", -0.16, -0.06, 0.22, 0.22, 0.18, 0.24, "#54c96d", "#2d8742", "#1d5a2b"),
    part("decor-b", 0.18, 0.08, 0.22, 0.18, 0.16, 0.18, accent, shade(accent, -0.24), shade(accent, -0.36)),
    part("decor-c", 0.00, 0.20, 0.22, 0.38, 0.08, 0.10, MAT.brassTop, MAT.brassLeft, MAT.brassRight),
  ];
  if (k === "bomb") return [
    ...baseParts(plinth, 0.72),
    part("bomb-body", 0, 0, 0.21, 0.42, 0.36, 0.32, "#594134", "#3b2920", "#261a14"),
    part("bomb-fuse", 0, -0.02, 0.50, 0.24, 0.18, 0.24, "#ff7a66", "#aa3b32", "#6d211d"),
  ];
  return generic(accent, plinth);
}

export function recipeVisibleParts(parts: PrismRecipePart[], progress = 1): PrismRecipePart[] {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  if (p >= 0.995) return parts;
  const visible = Math.max(1, Math.ceil(parts.length * Math.max(0.10, p)));
  return parts.slice(0, visible);
}