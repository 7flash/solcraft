/*
 * ECS DB shape checklist.
 *
 * This is deliberately not a migration runner.  It is a typed checklist used by
 * tests/admin health tooling so schema work stays explicit while the legacy
 * tables remain authoritative.
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
    legacyTable: "players/buildings/tiles/loot",
    legacyKeys: ["id", "x", "z"],
    targetInvariant: "Every durable world entity with a position has one integer tile coordinate pair.",
    ready: true,
  },
  {
    component: "Owner",
    legacyTable: "tiles/buildings",
    legacyKeys: ["owner"],
    targetInvariant: "Owner is 0 for neutral world entities or a valid players.id for player-owned entities.",
    ready: false,
  },
  {
    component: "Inventory",
    legacyTable: "players",
    legacyKeys: ["inv", "pack", "equip"],
    targetInvariant: "Resource bag, backpack, and equipped gear are normalized through player mutation helpers before ECS owns writes.",
    ready: false,
  },
  {
    component: "Structure",
    legacyTable: "buildings",
    legacyKeys: ["kind", "level", "hp", "maxHp", "acc", "accAt", "cdUntil", "stored"],
    targetInvariant: "Building HP/storage/producer/construction state has centralized update helpers before component replay.",
    ready: false,
  },
  {
    component: "Pickup",
    legacyTable: "loot",
    legacyKeys: ["kind", "gid"],
    targetInvariant: "Loot insert/delete is centralized; amount stacks are not introduced until pickup semantics are tested.",
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
