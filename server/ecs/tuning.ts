import type { GameRules } from "./types.ts";

/**
 * Conservative default rules for tests and staged migration.
 * The adapter can build this object from game/shared.ts LIBRARY and
 * ECONOMY_RULES so balancing stays centralized while systems stay pure.
 */
export const DEFAULT_ECS_RULES: GameRules = {
  movement: { maxChebStep: 1, energyPerStep: 0.08 },
  energy: { defaultMax: 100, defaultRegenPerMinute: 80 },
  claim: { cost: { e: 1, w: 2, s: 1 }, requireAdjacentOwnedTile: true },
  harvest: {
    costs: {
      tree: { e: 0.8 },
      rock: { e: 1.0 },
      food: { e: 0.6 },
      coin: { e: 0.2 },
    },
    yields: {
      tree: { w: 3 },
      rock: { s: 2 },
      food: { f: 2 },
      coin: { g: 1 },
    },
  },
  caps: { w: 250, p: 250, s: 250, f: 250, sh: 250, sc: 100 },
  buildings: {
    road: { kind: "road", label: "Road", cost: { w: 1 }, produces: {}, footprint: [1, 1], maxLevel: 1 },
    cottage: { kind: "cottage", label: "Cottage", cost: { w: 8, s: 4 }, upgradeCost: { w: 6, s: 4, f: 2 }, produces: {}, footprint: [1, 1], maxLevel: 5 },
    lumber: { kind: "lumber", label: "Lumber Camp", cost: { w: 10, s: 4 }, upgradeCost: { w: 8, s: 5 }, produces: {}, footprint: [1, 1], maxLevel: 5 },
    quarry: { kind: "quarry", label: "Quarry", cost: { w: 8, s: 8 }, upgradeCost: { w: 8, s: 8 }, produces: {}, footprint: [1, 1], maxLevel: 5 },
    farm: { kind: "farm", label: "Farm", cost: { w: 8, s: 3 }, upgradeCost: { w: 6, s: 3 }, produces: {}, footprint: [1, 1], maxLevel: 5 },
    market: { kind: "market", label: "Market", cost: { w: 16, s: 10, f: 6 }, upgradeCost: { w: 12, s: 8, f: 4 }, produces: {}, footprint: [1, 1], maxLevel: 5 },
    warehouse: { kind: "warehouse", label: "Warehouse", cost: { w: 14, s: 12 }, upgradeCost: { w: 12, s: 12 }, storageBonus: { w: 100, p: 100, s: 100, f: 100 }, footprint: [1, 1], maxLevel: 5 },
  },
};