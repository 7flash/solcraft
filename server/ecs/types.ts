/**
 * ECS core types for SolCraft.
 *
 * This layer is deliberately pure: no DB, no HTTP, no Three.js, no DOM.
 * Existing engine code can adapt database rows into these components, run a
 * system, then persist the changed components back to the current tables.
 */
export type EntityId = number;
export type Millis = number;

/** Legacy resource keys from game/shared.ts. Keep these stable during migration. */
export type ResKey = "e" | "w" | "p" | "s" | "f" | "g" | "sh" | "sc";
export type ResourceBag = Partial<Record<ResKey, number>>;

export type Coord = { x: number; z: number };
export type PositionC = Coord;

export type PlayerC = {
  id: EntityId;
  name: string;
  spectator?: boolean;
  level?: number;
  hp?: number;
  spawnX?: number;
  spawnZ?: number;
};

export type InventoryC = {
  resources: ResourceBag;
};

export type EnergyC = {
  value: number;
  max: number;
  regenPerMinute: number;
  settledAt: Millis;
};

export type TileC = Coord & {
  id?: EntityId;
  owner: EntityId | 0;
  biome?: string;
  hp?: number;
};

export type BuildingC = Coord & {
  id?: EntityId;
  uid: EntityId;
  kind: string;
  owner: EntityId | 0;
  level: number;
  hp?: number;
  maxHp?: number;
  stored?: ResourceBag;
  builtAt?: Millis;
  readyAt?: Millis;
};

export type DoodadC = Coord & {
  kind: "tree" | "rock" | "food" | "coin" | string;
  amount?: number;
};

export type LootC = Coord & {
  id?: EntityId;
  resources: ResourceBag;
};

export type EcsWorld = {
  version: number;
  nextEntityId: number;
  players: Map<EntityId, PlayerC>;
  positions: Map<EntityId, PositionC>;
  inventories: Map<EntityId, InventoryC>;
  energies: Map<EntityId, EnergyC>;
  tiles: Map<string, TileC>;
  buildings: Map<EntityId, BuildingC>;
  buildingAt: Map<string, EntityId>;
  doodads: Map<string, DoodadC>;
  loot: Map<string, LootC>;
  events: EcsEvent[];
};

export type EcsEvent = {
  t: Millis;
  entity?: EntityId;
  type: string;
  data?: Record<string, unknown>;
};

export type BuildingRule = {
  kind: string;
  label: string;
  cost: ResourceBag;
  upgradeCost?: ResourceBag;
  produces?: ResourceBag;
  storageBonus?: Partial<Record<ResKey, number>>;
  maxLevel?: number;
  footprint?: readonly [number, number];
};

export type GameRules = {
  movement: {
    maxChebStep: number;
    energyPerStep: number;
  };
  energy: {
    defaultMax: number;
    defaultRegenPerMinute: number;
  };
  claim: {
    cost: ResourceBag;
    requireAdjacentOwnedTile: boolean;
  };
  harvest: {
    costs: Partial<Record<string, ResourceBag>>;
    yields: Partial<Record<string, ResourceBag>>;
  };
  buildings: Record<string, BuildingRule>;
  caps: Partial<Record<ResKey, number>> & { total?: number; shared?: number };
};

export type SystemContext = {
  now: Millis;
  rules: GameRules;
};