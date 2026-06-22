// @ts-nocheck
import { duskHex } from "../theme/duskIndustrialPalette";

export const CHARACTER_COLOR_KEYS = ["skin", "hair", "primaryCloth", "secondaryCloth", "leather", "metal"];

// Constrained to the Dusk Industrial palette. Shape/body-part choices remain independent.
export const CHARACTER_COLOR_PRESETS = [
  { id: "dusk-runner", name: "Dusk Runner", look: "Scout", skin: duskHex("oliveStone"), hair: duskHex("ink"), primaryCloth: duskHex("slate"), secondaryCloth: duskHex("brass"), leather: duskHex("darkUmber"), metal: duskHex("blueGray"), parts: { head: 0, hair: 0, torso: 1, legs: 1, back: 0, tool: 0, hat: 0 } },
  { id: "iron-yard", name: "Iron Yard", look: "Worker", skin: duskHex("bone"), hair: duskHex("darkUmber"), primaryCloth: duskHex("brownBlack"), secondaryCloth: duskHex("blueGray"), leather: duskHex("warmBrown"), metal: duskHex("slateLight"), parts: { head: 1, hair: 0, torso: 2, legs: 2, back: 0, tool: 0, hat: 0 } },
  { id: "copper-smoke", name: "Copper Smoke", look: "Smith", skin: duskHex("oliveStone"), hair: duskHex("rustDark"), primaryCloth: duskHex("copper"), secondaryCloth: duskHex("brass"), leather: duskHex("darkUmber"), metal: duskHex("blueGray"), parts: { head: 2, hair: 0, torso: 3, legs: 3, back: 0, tool: 0, hat: 0 } },
  { id: "red-watch", name: "Red Watch", look: "Guard", skin: duskHex("bone"), hair: duskHex("ink"), primaryCloth: duskHex("deepOxblood"), secondaryCloth: duskHex("redMark"), leather: duskHex("darkUmber"), metal: duskHex("slateLight"), parts: { head: 3, hair: 0, torso: 4, legs: 4, back: 0, tool: 0, hat: 0 } },
  { id: "blue-wire", name: "Blue Wire", look: "Tinkerer", skin: duskHex("blueGray"), hair: duskHex("slateDeep"), primaryCloth: duskHex("electricBlue"), secondaryCloth: duskHex("bone"), leather: duskHex("brownBlack"), metal: duskHex("slateLight"), parts: { head: 4, hair: 0, torso: 5, legs: 5, back: 0, tool: 0, hat: 0 } },
  { id: "green-signal", name: "Green Signal", look: "Guide", skin: duskHex("oliveStone"), hair: duskHex("ink"), primaryCloth: duskHex("brownBlack"), secondaryCloth: duskHex("signalGreen"), leather: duskHex("warmBrown"), metal: duskHex("blueGray"), parts: { head: 5, hair: 0, torso: 6, legs: 6, back: 0, tool: 0, hat: 0 } },
  { id: "bone-coat", name: "Bone Coat", look: "Trader", skin: duskHex("bone"), hair: duskHex("darkUmber"), primaryCloth: duskHex("bone"), secondaryCloth: duskHex("brass"), leather: duskHex("warmBrown"), metal: duskHex("blueGray"), parts: { head: 6, hair: 0, torso: 7, legs: 7, back: 0, tool: 0, hat: 0 } },
  { id: "umber-settler", name: "Umber Settler", look: "Builder", skin: duskHex("oliveStone"), hair: duskHex("ink"), primaryCloth: duskHex("warmBrown"), secondaryCloth: duskHex("copper"), leather: duskHex("darkUmber"), metal: duskHex("slateLight"), parts: { head: 7, hair: 0, torso: 0, legs: 0, back: 0, tool: 0, hat: 0 } },
];

export const BUILDING_COLOR_PRESETS = [
  { id: "default", name: "Dusk Default", primary: null, secondary: duskHex("brass") },
  { id: "umber", name: "Umber / Bone", primary: duskHex("warmBrown"), secondary: duskHex("bone") },
  { id: "copper", name: "Copper / Brass", primary: duskHex("copper"), secondary: duskHex("brass") },
  { id: "slate", name: "Slate / Blue Gray", primary: duskHex("slate"), secondary: duskHex("blueGray") },
  { id: "oxblood", name: "Oxblood / Red", primary: duskHex("deepOxblood"), secondary: duskHex("redMark") },
  { id: "vault", name: "Vault Bone", primary: duskHex("bone"), secondary: duskHex("brass") },
  { id: "wire", name: "Signal Wires", primary: duskHex("electricBlue"), secondary: duskHex("signalGreen") },
  { id: "black", name: "Ink / Brass", primary: duskHex("ink"), secondary: duskHex("brass") },
];

export function normalizePresetHex(value: any, fallback = "#999999") {
  const s = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

export function presetHexToNumber(value: any, fallback: number) {
  const s = normalizePresetHex(value, "");
  return s ? parseInt(s.slice(1), 16) : fallback;
}

export function characterPresetById(id: any) {
  return CHARACTER_COLOR_PRESETS.find((p) => p.id === id) || CHARACTER_COLOR_PRESETS[0];
}

export function buildingPresetById(id: any) {
  return BUILDING_COLOR_PRESETS.find((p) => p.id === id) || BUILDING_COLOR_PRESETS[0];
}

export function characterPresetActive(profile: any, preset: any) {
  const palette = profile?.palette || profile || {};
  return CHARACTER_COLOR_KEYS.every((k) => normalizePresetHex(palette?.[k], "") === normalizePresetHex(preset[k], ""));
}
