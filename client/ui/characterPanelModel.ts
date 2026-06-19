export type CharacterPartKey = "head" | "torso" | "back" | "legs";

export type CharacterProfileLike = {
  palette?: Record<string, string | undefined>;
  parts?: Record<string, unknown>;
};

export type CharacterPresetLike = {
  id?: string;
  name?: string;
  skin?: string;
  hair?: string;
  primaryCloth?: string;
  secondaryCloth?: string;
  leather?: string;
  metal?: string;
};

export type CharacterPartRow = {
  key: CharacterPartKey;
  label: string;
  hint: string;
  value: number;
};

export const CHARACTER_PART_DEFS: Array<Omit<CharacterPartRow, "hint" | "value"> & { hint: string | ((value: number) => string) }> = [
  { key: "head", label: "Head", hint: "face / species" },
  { key: "torso", label: "Body", hint: "outfit shape" },
  { key: "back", label: "Back", hint: (value: number) => value === 0 ? "none" : "item" },
  { key: "legs", label: "Feet", hint: "legs / boots" },
];

export function clampCharacterPartValue(value: unknown): number {
  const n = Math.trunc(Number(value || 0));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(7, n));
}

export function characterPartRows(profile: CharacterProfileLike | null | undefined): CharacterPartRow[] {
  const parts = profile?.parts || {};
  return CHARACTER_PART_DEFS.map((def) => {
    const value = clampCharacterPartValue(parts[def.key]);
    return {
      key: def.key,
      label: def.label,
      hint: typeof def.hint === "function" ? def.hint(value) : def.hint,
      value,
    };
  });
}

export function normalizeCharacterHex(value: unknown, fallback = "#999999"): string {
  const s = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

const CHARACTER_COLOR_KEYS = ["skin", "hair", "primaryCloth", "secondaryCloth", "leather", "metal"] as const;

export function isCharacterPresetActive(profile: CharacterProfileLike | null | undefined, preset: CharacterPresetLike | null | undefined): boolean {
  const palette = profile?.palette || profile || {};
  if (!preset) return false;
  return CHARACTER_COLOR_KEYS.every((key) => normalizeCharacterHex((palette as any)?.[key], "") === normalizeCharacterHex((preset as any)?.[key], ""));
}

export function characterPresetCards(profile: CharacterProfileLike | null | undefined, presets: CharacterPresetLike[] = []) {
  return presets.map((preset) => ({
    preset,
    active: isCharacterPresetActive(profile, preset),
    skin: normalizeCharacterHex(preset.skin, "#f0b887"),
    primaryCloth: normalizeCharacterHex(preset.primaryCloth, "#31507d"),
    secondaryCloth: normalizeCharacterHex(preset.secondaryCloth, "#14f195"),
    leather: normalizeCharacterHex(preset.leather, "#6a4124"),
    metal: normalizeCharacterHex(preset.metal, "#b8c2cc"),
  }));
}

export function characterPanelViewModel(args: { profile?: CharacterProfileLike | null; presets?: CharacterPresetLike[] }) {
  return {
    partRows: characterPartRows(args.profile),
    presetCards: characterPresetCards(args.profile, args.presets || []),
  };
}
