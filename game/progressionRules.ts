export const PROGRESSION_RULES = {
  tileBaseCapacity: 18,
  tileCapacityPerLevel: 6,
  houseTileBonus: 2,
  townHallTileBonus: 24,
  worldWonderTileBonus: 80,
  helpfulXp: {
    capture: 8,
    buildStart: 8,
    buildComplete: 18,
    donate: 16,
    keepHit: 6,
    keepBreach: 80,
    reviveOrHelp: 24,
    wonderContribute: 120,
  },
} as const;

export type ProgressBuilding = { kind?: string; level?: number; done?: boolean; constructUntil?: number };

export function normalizedLevel(value: any) {
  const n = Math.floor(Number(value || 1));
  return Number.isFinite(n) ? Math.max(1, n) : 1;
}

export function isCompletedBuilding(b: ProgressBuilding, nowMs = Date.now()) {
  const until = Number((b as any)?.constructUntil || 0);
  return !until || until <= nowMs;
}

export function tileCapacityForProgress(input: { level?: any; buildings?: ProgressBuilding[]; nowMs?: number }) {
  const level = normalizedLevel(input?.level);
  const nowMs = Number(input?.nowMs || Date.now());
  const buildings = Array.isArray(input?.buildings) ? input.buildings : [];
  let bonus = 0;
  for (const b of buildings) {
    if (!b || !isCompletedBuilding(b, nowMs)) continue;
    const kind = String((b as any).kind || "").toLowerCase();
    const lvl = Math.max(1, Math.floor(Number((b as any).level || 1)));
    if (kind === "cottage" || kind === "house") bonus += PROGRESSION_RULES.houseTileBonus * lvl;
    else if (kind === "townhall") bonus += PROGRESSION_RULES.townHallTileBonus * lvl;
    else if (kind === "worldwonder") bonus += PROGRESSION_RULES.worldWonderTileBonus * lvl;
  }
  return Math.max(1, Math.round(PROGRESSION_RULES.tileBaseCapacity + (level - 1) * PROGRESSION_RULES.tileCapacityPerLevel + bonus));
}

export function tileCapacityExplanation(input: { level?: any; buildings?: ProgressBuilding[]; nowMs?: number }) {
  const level = normalizedLevel(input?.level);
  const cap = tileCapacityForProgress(input);
  return `Level ${level} supports ${cap} captured tiles. Helping others, donating, building, and Keep raids are the main ways to grow.`;
}
