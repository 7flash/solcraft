import { DUSK_INDUSTRIAL_HEX as DUSK_HEX } from "./duskIndustrialPalette";

export type WonderPalette = { id: string; name: string; colors: string[] };

export const WONDER_PALETTE_COLORS: Record<string, string[]> = {
  solar: [DUSK_HEX.bone, DUSK_HEX.brass, DUSK_HEX.copper, DUSK_HEX.slate],
  arcane: [DUSK_HEX.bone, DUSK_HEX.electricBlue, DUSK_HEX.slateDeep, DUSK_HEX.blueGray],
  emerald: [DUSK_HEX.bone, DUSK_HEX.signalGreen, DUSK_HEX.warmBrown, DUSK_HEX.blueGray],
  ember: [DUSK_HEX.bone, DUSK_HEX.copper, DUSK_HEX.redMark, DUSK_HEX.rustDark],
  frost: [DUSK_HEX.bone, DUSK_HEX.blueGray, DUSK_HEX.slateLight, DUSK_HEX.slateDeep],
  royal: [DUSK_HEX.bone, DUSK_HEX.brass, DUSK_HEX.electricBlue, DUSK_HEX.deepOxblood],
};

export const DEFAULT_WONDER_PALETTES: WonderPalette[] = [
  { id: "solar", name: "Solar gold", colors: WONDER_PALETTE_COLORS.solar },
  { id: "arcane", name: "Arcane blue", colors: WONDER_PALETTE_COLORS.arcane },
  { id: "emerald", name: "Signal green", colors: WONDER_PALETTE_COLORS.emerald },
  { id: "ember", name: "Ember red", colors: WONDER_PALETTE_COLORS.ember },
  { id: "frost", name: "Frost slate", colors: WONDER_PALETTE_COLORS.frost },
  { id: "royal", name: "Royal dusk", colors: WONDER_PALETTE_COLORS.royal },
];

export function localizeWonderPalettes(names: any): WonderPalette[] {
  const nameById = new Map<string, string>();
  if (Array.isArray(names)) {
    for (const row of names) {
      if (row?.id) nameById.set(String(row.id), String(row.name || row.id));
    }
  } else if (names && typeof names === "object") {
    for (const [id, name] of Object.entries(names)) nameById.set(id, String(name));
  }
  return DEFAULT_WONDER_PALETTES.map((p) => ({ ...p, name: nameById.get(p.id) || p.name }));
}
