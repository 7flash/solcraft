// @ts-nocheck
/** Server-side copy of the Dusk Industrial palette for SVG/API fallbacks. */
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

const ORDER = ["ink", "deepOxblood", "darkUmber", "brownBlack", "warmBrown", "rustDark", "copper", "brass", "oliveStone", "slateDeep", "slate", "slateLight", "blueGray", "bone", "redMark", "electricBlue", "signalGreen"] as const;

export const DUSK_ATLAS_BG = DUSK_INDUSTRIAL_HEX.ink;
export const DUSK_ATLAS_TEXT = DUSK_INDUSTRIAL_HEX.bone;

export function duskAtlasFallbackCell(atlas: string, x: number, y: number) {
  const a = String(atlas || "").toLowerCase();
  const offset = a === "terrain" ? 4 : a === "building" ? 7 : a === "doll" ? 10 : a === "tool" ? 12 : a === "ui" ? 2 : 0;
  const idx = Math.max(0, x + y * 7 + offset) % ORDER.length;
  return DUSK_INDUSTRIAL_HEX[ORDER[idx]];
}
