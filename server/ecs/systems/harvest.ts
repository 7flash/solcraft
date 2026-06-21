import type { EcsWorld, EntityId, ResourceBag, SystemContext } from "../types.ts";
import { key, addBag, spendBag } from "../math.ts";
import { err, ok, type Result } from "../result.ts";
import { addEvent, bump, getInventory } from "../world.ts";
import { spendEnergy } from "./energy.ts";

export function harvestAt(world: EcsWorld, playerId: EntityId, x: number, z: number, ctx: SystemContext): Result<{ gained: ResourceBag }> {
  const k = key(x | 0, z | 0);
  const doodad = world.doodads.get(k);
  const loot = world.loot.get(k);
  if (!doodad && !loot) return err("Nothing to gather here", "NO_RESOURCE_NODE");

  const inv = getInventory(world, playerId).resources;
  const sourceKind = doodad?.kind || "loot";
  const cost = sourceKind === "loot" ? {} : (ctx.rules.harvest.costs[sourceKind] || {});
  const energyCost = Number(cost.e || 0);
  if (energyCost > 0) {
    const spent = spendEnergy(world, playerId, energyCost, ctx.now);
    if (!spent.ok) return spent;
  }
  const nonEnergyCost = { ...cost };
  delete (nonEnergyCost as any).e;
  const paid = spendBag(inv, nonEnergyCost);
  if (paid !== true) return err("Missing resources for harvest", "HARVEST_COST", paid);

  const gained = loot ? { ...loot.resources } : { ...(ctx.rules.harvest.yields[sourceKind] || {}) };
  if (doodad?.amount != null) {
    for (const k of Object.keys(gained) as (keyof ResourceBag)[]) gained[k] = Number(gained[k] || 0) * Math.max(1, Number(doodad.amount || 1));
  }
  addBag(inv, gained, ctx.rules.caps);
  if (loot) world.loot.delete(k);
  if (doodad) world.doodads.delete(k);
  bump(world);
  addEvent(world, { t: ctx.now, entity: playerId, type: "harvest", data: { x, z, kind: sourceKind, gained } });
  return ok({ gained });
}
