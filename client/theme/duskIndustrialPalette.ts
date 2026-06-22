// @ts-nocheck
/**
 * Dusk Industrial art direction.
 *
 * This is a constrained color system, not a pixel-art renderer. 3D meshes,
 * canvas textures, billboards, and SVG fallbacks should stay smooth/low-poly;
 * they simply choose colors from this source image palette so the world reads
 * as one coherent dusk/industrial scene.
 */
export const DUSK_INDUSTRIAL_HEX = {
  ink: "#070411",
  deepOxblood: "#280E14",
  darkUmber: "#392319",
  brownBlack: "#453927",
  warmBrown: "#594C38",
  rustDark: "#67220B",
  copper: "#985D23",
  brass: "#CEB443",
  oliveStone: "#8C8565",
  slateDeep: "#222F42",
  slate: "#425067",
  slateLight: "#5D6A7E",
  blueGray: "#82979E",
  bone: "#D7DFCF",
  redMark: "#A03C35",
  electricBlue: "#243D87",
  signalGreen: "#2F952F",
} as const;

export type DuskColorName = keyof typeof DUSK_INDUSTRIAL_HEX;

export const DUSK_INDUSTRIAL_ORDER: DuskColorName[] = [
  "ink", "deepOxblood", "darkUmber", "brownBlack", "warmBrown",
  "rustDark", "copper", "brass", "oliveStone", "slateDeep",
  "slate", "slateLight", "blueGray", "bone", "redMark",
  "electricBlue", "signalGreen",
];

export const DUSK_INDUSTRIAL_NUMBER = Object.fromEntries(
  Object.entries(DUSK_INDUSTRIAL_HEX).map(([k, v]) => [k, parseInt(String(v).slice(1), 16)]),
) as Record<DuskColorName, number>;

export const DUSK_TERRAIN_HEX: Record<string, string> = {
  // Stage82: keep the exact Dusk Industrial palette, but choose the lighter members for terrain.
  // The world was reading as night even at daytime because grass/neutral used near-black browns.
  sand: DUSK_INDUSTRIAL_HEX.oliveStone,
  grass: DUSK_INDUSTRIAL_HEX.oliveStone,
  forest: DUSK_INDUSTRIAL_HEX.warmBrown,
  water: DUSK_INDUSTRIAL_HEX.slateLight,
  rock: DUSK_INDUSTRIAL_HEX.blueGray,
  stone: DUSK_INDUSTRIAL_HEX.blueGray,
  road: DUSK_INDUSTRIAL_HEX.copper,
  snow: DUSK_INDUSTRIAL_HEX.bone,
  claimed: DUSK_INDUSTRIAL_HEX.copper,
  neutral: DUSK_INDUSTRIAL_HEX.oliveStone,
};

export const DUSK_BUILDING_HEX: Record<string, { wall: string; roof: string; trim: string; shadow: string }> = {
  house: { wall: DUSK_INDUSTRIAL_HEX.warmBrown, roof: DUSK_INDUSTRIAL_HEX.darkUmber, trim: DUSK_INDUSTRIAL_HEX.bone, shadow: DUSK_INDUSTRIAL_HEX.ink },
  warehouse: { wall: DUSK_INDUSTRIAL_HEX.brownBlack, roof: DUSK_INDUSTRIAL_HEX.rustDark, trim: DUSK_INDUSTRIAL_HEX.oliveStone, shadow: DUSK_INDUSTRIAL_HEX.ink },
  lumber: { wall: DUSK_INDUSTRIAL_HEX.copper, roof: DUSK_INDUSTRIAL_HEX.darkUmber, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  quarry: { wall: DUSK_INDUSTRIAL_HEX.slateLight, roof: DUSK_INDUSTRIAL_HEX.slateDeep, trim: DUSK_INDUSTRIAL_HEX.blueGray, shadow: DUSK_INDUSTRIAL_HEX.ink },
  mine: { wall: DUSK_INDUSTRIAL_HEX.slateLight, roof: DUSK_INDUSTRIAL_HEX.slateDeep, trim: DUSK_INDUSTRIAL_HEX.blueGray, shadow: DUSK_INDUSTRIAL_HEX.ink },
  farm: { wall: DUSK_INDUSTRIAL_HEX.oliveStone, roof: DUSK_INDUSTRIAL_HEX.darkUmber, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  market: { wall: DUSK_INDUSTRIAL_HEX.copper, roof: DUSK_INDUSTRIAL_HEX.rustDark, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  bank: { wall: DUSK_INDUSTRIAL_HEX.bone, roof: DUSK_INDUSTRIAL_HEX.slateDeep, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  vault: { wall: DUSK_INDUSTRIAL_HEX.bone, roof: DUSK_INDUSTRIAL_HEX.slateDeep, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  customizer: { wall: DUSK_INDUSTRIAL_HEX.deepOxblood, roof: DUSK_INDUSTRIAL_HEX.darkUmber, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  townhall: { wall: DUSK_INDUSTRIAL_HEX.warmBrown, roof: DUSK_INDUSTRIAL_HEX.rustDark, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
  worldwonder: { wall: DUSK_INDUSTRIAL_HEX.brass, roof: DUSK_INDUSTRIAL_HEX.copper, trim: DUSK_INDUSTRIAL_HEX.bone, shadow: DUSK_INDUSTRIAL_HEX.ink },
  keep: { wall: DUSK_INDUSTRIAL_HEX.slate, roof: DUSK_INDUSTRIAL_HEX.deepOxblood, trim: DUSK_INDUSTRIAL_HEX.redMark, shadow: DUSK_INDUSTRIAL_HEX.ink },
  default: { wall: DUSK_INDUSTRIAL_HEX.warmBrown, roof: DUSK_INDUSTRIAL_HEX.darkUmber, trim: DUSK_INDUSTRIAL_HEX.brass, shadow: DUSK_INDUSTRIAL_HEX.ink },
};

export function duskHex(name: DuskColorName | string, fallback: DuskColorName | string = "bone") {
  const v = (DUSK_INDUSTRIAL_HEX as any)[String(name || "")];
  if (v) return v;
  const raw = String(name || fallback || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  return (DUSK_INDUSTRIAL_HEX as any)[String(fallback)] || DUSK_INDUSTRIAL_HEX.bone;
}

export function duskNumber(name: DuskColorName | string, fallback: DuskColorName | string = "bone") {
  return parseInt(duskHex(name, fallback).slice(1), 16);
}

export function duskTerrainHex(kind: string, fallback = "sand") {
  return DUSK_TERRAIN_HEX[String(kind || "").toLowerCase()] || DUSK_TERRAIN_HEX[fallback] || DUSK_TERRAIN_HEX.sand;
}

export function duskBuildingPalette(kind: string) {
  return DUSK_BUILDING_HEX[String(kind || "").toLowerCase()] || DUSK_BUILDING_HEX.default;
}

export function duskAtlasFallbackHex(atlas: string, index: number) {
  const a = String(atlas || "").toLowerCase();
  const offset = a === "terrain" ? 4 : a === "building" ? 7 : a === "doll" ? 10 : a === "tool" ? 12 : a === "ui" ? 2 : 0;
  const names = DUSK_INDUSTRIAL_ORDER;
  return DUSK_INDUSTRIAL_HEX[names[(Math.max(0, index) + offset) % names.length]];
}

export function duskPlayerPaletteBySeed(seed: any = 0) {
  const n = Math.abs(Number(seed) || String(seed || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const cloth = ["slate", "deepOxblood", "warmBrown", "rustDark", "electricBlue", "brownBlack"][n % 6] as DuskColorName;
  const trim = ["brass", "bone", "blueGray", "oliveStone"][n % 4] as DuskColorName;
  return {
    body: duskNumber(cloth),
    skin: duskHex("oliveStone"),
    hair: duskHex(n % 2 ? "ink" : "darkUmber"),
    primaryCloth: duskHex(cloth),
    secondaryCloth: duskHex(trim),
    leather: duskHex("darkUmber"),
    metal: duskHex("blueGray"),
  };
}

export function duskCssVars() {
  return Object.fromEntries(Object.entries(DUSK_INDUSTRIAL_HEX).map(([k, v]) => [`--dusk-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, v]));
}
