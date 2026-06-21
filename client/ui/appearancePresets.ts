// @ts-nocheck

export const CHARACTER_COLOR_KEYS = ["skin", "hair", "primaryCloth", "secondaryCloth", "leather", "metal"];
export const CHARACTER_COLOR_PRESETS = [
  { id: "solana", name: "Solana", look: "Explorer", skin: "#f0b887", hair: "#f4f0dd", primaryCloth: "#31507d", secondaryCloth: "#14f195", leather: "#6a4124", metal: "#b8c2cc", parts: { head: 0, hair: 0, torso: 1, legs: 1, back: 0, tool: 0, hat: 0 } },
  { id: "forest", name: "Forest", look: "Ranger", skin: "#c68f63", hair: "#2f2118", primaryCloth: "#2f6b46", secondaryCloth: "#8fbf6a", leather: "#5a3a22", metal: "#b0b9b5", parts: { head: 1, hair: 0, torso: 2, legs: 2, back: 0, tool: 0, hat: 0 } },
  { id: "sunforge", name: "Sunforge", look: "Smith", skin: "#a96b4d", hair: "#f2c35b", primaryCloth: "#8e3d26", secondaryCloth: "#e0b54a", leather: "#6a3e20", metal: "#ffe0a6", parts: { head: 2, hair: 0, torso: 3, legs: 3, back: 0, tool: 0, hat: 0 } },
  { id: "tide", name: "Tide", look: "Sailor", skin: "#8cc7d8", hair: "#17384a", primaryCloth: "#1e5f86", secondaryCloth: "#7dcfe8", leather: "#38516a", metal: "#d6f2ff", parts: { head: 3, hair: 0, torso: 4, legs: 4, back: 0, tool: 0, hat: 0 } },
  { id: "violet", name: "Violet", look: "Mage", skin: "#d5a5ff", hair: "#33204a", primaryCloth: "#56359b", secondaryCloth: "#9945ff", leather: "#4b315f", metal: "#dec8ff", parts: { head: 4, hair: 0, torso: 5, legs: 5, back: 0, tool: 0, hat: 0 } },
  { id: "rose", name: "Rose", look: "Trader", skin: "#f0b8a0", hair: "#5b2434", primaryCloth: "#8f3049", secondaryCloth: "#f08bb0", leather: "#6a3b35", metal: "#ffd5dc", parts: { head: 5, hair: 0, torso: 6, legs: 6, back: 0, tool: 0, hat: 0 } },
  { id: "ash", name: "Ash", look: "Guard", skin: "#d2c4ad", hair: "#2a2e35", primaryCloth: "#4a4f5a", secondaryCloth: "#9aa3ad", leather: "#37312d", metal: "#cbd1d8", parts: { head: 6, hair: 0, torso: 7, legs: 7, back: 0, tool: 0, hat: 0 } },
  { id: "mint", name: "Mint", look: "Builder", skin: "#f2d2ad", hair: "#0f332d", primaryCloth: "#146b5a", secondaryCloth: "#14f195", leather: "#4b3a22", metal: "#dbfff1", parts: { head: 7, hair: 0, torso: 0, legs: 0, back: 0, tool: 0, hat: 0 } },
];

export const BUILDING_COLOR_PRESETS = [
  { id: "default", name: "Default", primary: null, secondary: "#ffd76e" },
  { id: "paper", name: "Paper / Brick", primary: "#f6e7c8", secondary: "#d6604f" },
  { id: "harbor", name: "Harbor Blue", primary: "#3f8ab5", secondary: "#7dcfe8" },
  { id: "grove", name: "Grove Mint", primary: "#35b87a", secondary: "#14f195" },
  { id: "sun", name: "Sun Gold", primary: "#e0b54a", secondary: "#ffe0a6" },
  { id: "violet", name: "Violet Neon", primary: "#9263c4", secondary: "#9945ff" },
  { id: "rose", name: "Rose Clay", primary: "#f08bb0", secondary: "#d6604f" },
  { id: "slate", name: "Slate Ice", primary: "#4a4f5a", secondary: "#7dcfe8" },
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
  // Color presets should only decide skin/clothes/material colors.
  // Shape/body-part choices stay independently editable.
  const palette = profile?.palette || profile || {};
  return CHARACTER_COLOR_KEYS.every((k) => normalizePresetHex(palette?.[k], "") === normalizePresetHex(preset[k], ""));
}
