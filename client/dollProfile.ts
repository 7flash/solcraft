// @ts-nocheck
import {
  normalizeDollParts,
  normalizeDollPalette,
  loadSavedDollParts,
  saveDollParts,
  DEFAULT_DOLL_PALETTE,
  type DollParts,
  type DollPalette,
} from "./dolls";

export const CHARACTER_PROFILE_KEY = "world-of-solcrafts:character:v1";
const OLD_CHARACTER_PROFILE_KEY = "solcraft:character:v1";

export type CharacterProfile = {
  parts: DollParts;
  palette: Required<DollPalette>;
  outfit: {
    torso: number;
    legs: number;
    back: number;
  };
  showBack: boolean;
};

export function defaultCharacterProfile(): CharacterProfile {
  const parts = loadSavedDollParts();
  return {
    parts,
    palette: { ...DEFAULT_DOLL_PALETTE },
    outfit: {
      torso: parts.torso,
      legs: parts.legs,
      back: parts.back,
    },
    showBack: parts.showBack ?? false,
  };
}

export function loadCharacterProfile(): CharacterProfile {
  const fallback = defaultCharacterProfile();

  try {
    const raw = localStorage.getItem(CHARACTER_PROFILE_KEY) || localStorage.getItem(OLD_CHARACTER_PROFILE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const parts = normalizeDollParts({
      ...fallback.parts,
      ...(parsed.parts || {}),
      torso: parsed.outfit?.torso ?? parsed.parts?.torso ?? fallback.parts.torso,
      legs: parsed.outfit?.legs ?? parsed.parts?.legs ?? fallback.parts.legs,
      back: parsed.outfit?.back ?? parsed.parts?.back ?? fallback.parts.back,
      head: parsed.parts?.head ?? parsed.parts?.skin ?? parsed.parts?.face ?? fallback.parts.head,
      showBack: parsed.showBack ?? parsed.parts?.showBack ?? fallback.showBack,
    });

    return {
      parts,
      palette: normalizeDollPalette({ ...fallback.palette, ...(parsed.palette || {}) }),
      outfit: {
        torso: parts.torso,
        legs: parts.legs,
        back: parts.back,
      },
      showBack: parts.showBack ?? false,
    };
  } catch {
    return fallback;
  }
}

export function saveCharacterProfile(profile: CharacterProfile): CharacterProfile {
  const parts = normalizeDollParts({
    ...profile.parts,
    torso: profile.outfit?.torso ?? profile.parts.torso,
    legs: profile.outfit?.legs ?? profile.parts.legs,
    back: profile.outfit?.back ?? profile.parts.back,
    head: profile.parts?.head ?? profile.parts?.skin ?? profile.parts?.face ?? 0,
    showBack: profile.showBack,
  });

  const normalized: CharacterProfile = {
    parts,
    palette: normalizeDollPalette(profile.palette || {}),
    outfit: {
      torso: parts.torso,
      legs: parts.legs,
      back: parts.back,
    },
    showBack: parts.showBack ?? false,
  };

  try {
    localStorage.setItem(CHARACTER_PROFILE_KEY, JSON.stringify(normalized));
    localStorage.removeItem(OLD_CHARACTER_PROFILE_KEY);
  } catch {}

  // Keep legacy Doll-part storage in sync, but do not clear/dispose the global
  // Doll texture cache here. The game may have active sprites using those maps,
  // and disposing them during a color slider drag is what caused blink/disappear.
  saveDollParts(normalized.parts);

  return normalized;
}