/*
 * ECS DB shape checklist.
 *
 * This is deliberately not a migration runner. It is a typed checklist used by
 * tests/admin health tooling so schema work stays explicit while the clean ECS
 * release remains easy to audit.
 */

export type EcsComponentTablePlan = {
  component: string;
  legacyTable: string;
  legacyKeys: string[];
  targetInvariant: string;
  ready: boolean;
};

export const ECS_COMPONENT_TABLE_PLAN: EcsComponentTablePlan[] = [
  {
    component: "Position",
    legacyTable: "players/buildings/tiles/loot/keeps/npcs/wonders",
    legacyKeys: ["id", "x", "z"],
    targetInvariant: "Every durable world entity with a position has one integer tile coordinate pair.",
    ready: true,
  },
  {
    component: "Owner",
    legacyTable: "tiles/buildings/wonders/referralCodes/giftGrants",
    legacyKeys: ["owner", "ownerId", "sponsorId", "createdBy"],
    targetInvariant: "Owner is 0/null for neutral world entities or a valid players.id for player-owned entities.",
    ready: true,
  },
  {
    component: "Inventory",
    legacyTable: "players/playerResources/playerCosmetics/bankLedger",
    legacyKeys: ["wood", "stone", "food", "coins", "cosmeticId"],
    targetInvariant: "Resource, coin, and cosmetic mutations flow through store/service helpers before ECS owns writes.",
    ready: false,
  },
  {
    component: "Structure",
    legacyTable: "buildings/keeps/wonders",
    legacyKeys: ["kind", "level", "hp", "maxHp", "stored", "meta"],
    targetInvariant: "Building HP/storage/service/construction state is centralized before component replay.",
    ready: false,
  },
  {
    component: "Pickup",
    legacyTable: "loot",
    legacyKeys: ["kind", "x", "z", "amount", "gid"],
    targetInvariant: "Loot insert/delete/exact-cell lookups are centralized through lootStore.",
    ready: true,
  },
  {
    component: "Reputation",
    legacyTable: "players/reputationEvents",
    legacyKeys: ["rep", "reason", "delta"],
    targetInvariant: "Single clean reputation replaces faction standing and controls trusted frontier capacity.",
    ready: true,
  },
  {
    component: "ReferralGift",
    legacyTable: "referralCodes/referralClaims/giftGrants/playerCosmetics",
    legacyKeys: ["code", "sponsorId", "claimedBy", "giftJson", "rewardCoins"],
    targetInvariant: "Referral rewards are sponsor-funded, one-time per player, and auditable by code and claim row.",
    ready: true,
  },
];

export function ecsDbShapeChecklist() {
  const ready = ECS_COMPONENT_TABLE_PLAN.filter((p) => p.ready).length;
  return {
    ready,
    total: ECS_COMPONENT_TABLE_PLAN.length,
    items: ECS_COMPONENT_TABLE_PLAN,
  };
}
