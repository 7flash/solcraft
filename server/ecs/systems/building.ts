import type { BuildingC, EcsWorld, EntityId, ResourceBag, SystemContext } from "../types.ts";
import { spendBag } from "../math.ts";
import { err, ok, type Result } from "../result.ts";
import { addBuilding, addEvent, buildingAt, getInventory, getTile, removeBuilding } from "../world.ts";
import { spendEnergy } from "./energy.ts";

function payCost(world: EcsWorld, playerId: EntityId, cost: ResourceBag, ctx: SystemContext): Result {
  const inv = getInventory(world, playerId).resources;
  const energyCost = Number(cost.e || 0);
  if (energyCost > 0) {
    const spent = spendEnergy(world, playerId, energyCost, ctx.now);
    if (!spent.ok) return spent;
  }
  const rest = { ...cost };
  delete (rest as any).e;
  const paid = spendBag(inv, rest);
  return paid === true ? ok() : err("Not enough resources", "BUILDING_COST", paid);
}

export function placeBuilding(world: EcsWorld, playerId: EntityId, kind: string, x: number, z: number, ctx: SystemContext): Result<{ uid: number; building: BuildingC }> {
  x |= 0; z |= 0;
  const rule = ctx.rules.buildings[String(kind || "")];
  if (!rule) return err("Unknown building", "UNKNOWN_BUILDING", { kind });
  const tile = getTile(world, x, z);
  if (Number(tile?.owner || 0) !== playerId) return err("Claim the tile first", "TILE_NOT_OWNED");
  if (buildingAt(world, x, z)) return err("Tile already has a building", "BUILDING_OCCUPIED");
  const paid = payCost(world, playerId, rule.cost || {}, ctx);
  if (!paid.ok) return paid;
  const uid = world.nextEntityId;
  const building: BuildingC = { uid, kind: rule.kind, owner: playerId, x, z, level: 1, stored: {}, builtAt: ctx.now, readyAt: ctx.now };
  addBuilding(world, building);
  addEvent(world, { t: ctx.now, entity: playerId, type: "place", data: { uid, kind, x, z } });
  return ok({ uid, building: world.buildings.get(uid)! });
}

export function upgradeBuilding(world: EcsWorld, playerId: EntityId, uid: EntityId, ctx: SystemContext): Result<{ uid: number; level: number }> {
  const b = world.buildings.get(uid);
  if (!b) return err("Building not found", "BUILDING_NOT_FOUND");
  if (Number(b.owner || 0) !== playerId) return err("Not your building", "NOT_OWNER");
  const rule = ctx.rules.buildings[b.kind];
  if (!rule) return err("Unknown building", "UNKNOWN_BUILDING", { kind: b.kind });
  const max = Number(rule.maxLevel || 5);
  if (b.level >= max) return err("Building is already max level", "MAX_LEVEL");
  const mult = Math.max(1, b.level);
  const cost: ResourceBag = {};
  for (const [k, v] of Object.entries(rule.upgradeCost || rule.cost || {}) as [keyof ResourceBag, number][]) cost[k] = Number(v || 0) * mult;
  const paid = payCost(world, playerId, cost, ctx);
  if (!paid.ok) return paid;
  b.level += 1;
  world.version += 1;
  addEvent(world, { t: ctx.now, entity: playerId, type: "upgrade", data: { uid, level: b.level } });
  return ok({ uid, level: b.level });
}

export function demolishBuilding(world: EcsWorld, playerId: EntityId, uid: EntityId, ctx: SystemContext): Result<{ uid: number }> {
  const b = world.buildings.get(uid);
  if (!b) return err("Building not found", "BUILDING_NOT_FOUND");
  if (Number(b.owner || 0) !== playerId) return err("Not your building", "NOT_OWNER");
  removeBuilding(world, uid);
  addEvent(world, { t: ctx.now, entity: playerId, type: "demolish", data: { uid } });
  return ok({ uid });
}
