import { metaGet, metaSet } from "./db";

export type FactionId = "empire" | "bandits";
export type FactionStanding = Record<FactionId, number>;

const META_FACTION_PREFIX = "solcraft:factions:v1:";
const MIN_STANDING = -100;
const MAX_STANDING = 100;

export const FACTION_DEFS: Record<FactionId, { id: FactionId; name: string; glyph: string }> = {
  empire: { id: "empire", name: "Empire", glyph: "⚜" },
  bandits: { id: "bandits", name: "Bandits", glyph: "☠" },
};

export const FACTION_REASONS = {
  npcDonate: "Helping frontier travelers",
  npcKill: "Robbing frontier travelers",
  keepHit: "Pressuring a bandit Keep",
  keepBreach: "Breaching a bandit Keep",
  keepDonate: "Funding a bandit Keep",
} as const;

function key(playerId: number) {
  return `${META_FACTION_PREFIX}${Math.max(0, Math.floor(Number(playerId || 0)))}`;
}

function clampStanding(value: any) {
  const n = Math.floor(Number(value || 0));
  if (!Number.isFinite(n)) return 0;
  return Math.max(MIN_STANDING, Math.min(MAX_STANDING, n));
}

export function emptyFactionStanding(): FactionStanding {
  return { empire: 0, bandits: 0 };
}

export function normalizeFactionStanding(raw: any): FactionStanding {
  const obj = raw && typeof raw === "object" ? raw : {};
  return {
    empire: clampStanding(obj.empire),
    bandits: clampStanding(obj.bandits),
  };
}

export function readFactionStanding(playerId: number): FactionStanding {
  try {
    return normalizeFactionStanding(JSON.parse(metaGet(key(playerId), "{}") || "{}"));
  } catch {
    return emptyFactionStanding();
  }
}

export function writeFactionStanding(playerId: number, standing: FactionStanding) {
  const next = normalizeFactionStanding(standing);
  metaSet(key(playerId), JSON.stringify(next));
  return next;
}

export function adjustFactionStanding(playerId: number, delta: Partial<FactionStanding>) {
  const cur = readFactionStanding(playerId);
  const next = normalizeFactionStanding({
    empire: cur.empire + Number(delta.empire || 0),
    bandits: cur.bandits + Number(delta.bandits || 0),
  });
  writeFactionStanding(playerId, next);
  return next;
}

export function factionTitle(id: FactionId, standing: number) {
  const n = clampStanding(standing);
  if (id === "empire") {
    if (n >= 75) return "Imperial Champion";
    if (n >= 45) return "Trusted Citizen";
    if (n >= 20) return "Frontier Friend";
    if (n <= -60) return "Wanted Raider";
    if (n <= -25) return "Distrusted";
    return "Neutral";
  }
  if (n >= 75) return "Keep Patron";
  if (n >= 45) return "Black-Market Friend";
  if (n >= 20) return "Fence Contact";
  if (n <= -60) return "Marked Enemy";
  if (n <= -25) return "Unwelcome";
  return "Neutral";
}

export function factionTileCapacityBonus(standing: FactionStanding) {
  const empireBonus = Math.max(0, Math.floor(clampStanding(standing.empire) / 20));
  const banditBonus = Math.max(0, Math.floor(clampStanding(standing.bandits) / 25));
  return Math.min(10, empireBonus + banditBonus);
}

export function factionSummaryForWire(playerId: number) {
  const standing = readFactionStanding(playerId);
  return {
    ...standing,
    defs: FACTION_DEFS,
    titles: {
      empire: factionTitle("empire", standing.empire),
      bandits: factionTitle("bandits", standing.bandits),
    },
    tileBonus: factionTileCapacityBonus(standing),
  };
}

export function factionDeltaText(delta: Partial<FactionStanding>, next: FactionStanding) {
  const parts: string[] = [];
  for (const id of ["empire", "bandits"] as FactionId[]) {
    const d = Math.floor(Number(delta[id] || 0));
    if (!d) continue;
    const def = FACTION_DEFS[id];
    const signed = d > 0 ? `+${d}` : String(d);
    parts.push(`${def.glyph} ${def.name} ${signed} (${next[id]})`);
  }
  return parts.join(" · ");
}
