// Stage 14 compatibility facade.
// The major-release game no longer has factions. Old imports are kept so legacy
// files still type-check while ECS/client code moves to reputationRules.
import { adjustReputation, readReputation, reputationDeltaText, reputationSummaryForWire, reputationTileBonus } from "./reputationRules";

export type FactionId = "empire" | "bandits";
export type FactionStanding = Record<FactionId, number>;

export const FACTION_DEFS: Record<FactionId, { id: FactionId; name: string; glyph: string }> = {
  empire: { id: "empire", name: "Reputation", glyph: "★" },
  bandits: { id: "bandits", name: "Removed", glyph: "" },
};

export const FACTION_REASONS = {
  npcDonate: "Helping travelers",
  npcKill: "Killing travelers",
  keepHit: "Raiding a Keep",
  keepBreach: "Destroying a Keep",
  keepDonate: "Donating to a Keep",
} as const;

export function emptyFactionStanding(): FactionStanding { return { empire: 0, bandits: 0 }; }
export function normalizeFactionStanding(raw: any): FactionStanding { return { empire: Number(raw?.empire || 0) || 0, bandits: 0 }; }
export function readFactionStanding(playerId: number): FactionStanding { return { empire: readReputation(playerId), bandits: 0 }; }
export function writeFactionStanding(playerId: number, standing: FactionStanding) { adjustReputation(playerId, Number(standing.empire || 0) - readReputation(playerId), "admin"); return readFactionStanding(playerId); }
export function adjustFactionStanding(playerId: number, delta: Partial<FactionStanding>) {
  // Existing callers used empire-positive and bandit-positive for opposite moral
  // directions. Summing them preserves Stage 4/13 behavior while collapsing to one value.
  const net = Number(delta.empire || 0) + Number(delta.bandits || 0);
  const change = adjustReputation(playerId, net, "admin");
  return { empire: change.after, bandits: 0 };
}
export function factionTitle(_id: FactionId, standing: number) { return reputationSummaryForWire(0).title || String(standing); }
export function factionTileCapacityBonus(standing: FactionStanding) { return reputationTileBonus(Number(standing.empire || 0)); }
export function factionSummaryForWire(playerId: number) {
  const rep = reputationSummaryForWire(playerId);
  return { empire: rep.value, bandits: 0, defs: FACTION_DEFS, titles: { empire: rep.title, bandits: "Removed" }, tileBonus: rep.tileBonus, removed: true, reputation: rep };
}
export function factionDeltaText(_delta: Partial<FactionStanding>, next: FactionStanding) {
  return reputationDeltaText({ before: Number(next.empire || 0), after: Number(next.empire || 0), delta: 0 });
}
