import type { EcsWorld, EntityId, ResourceBag, SystemContext } from "../types.ts";
import { addBag } from "../math.ts";
import { ok, type Result } from "../result.ts";
import { addEvent, getInventory } from "../world.ts";

export function productionForBuilding(kind: string, level: number, ctx: SystemContext): ResourceBag {
  const rule = ctx.rules.buildings[kind];
  const out: ResourceBag = {};
  if (!rule?.produces) return out;
  const lvl = Math.max(1, Number(level || 1));
  for (const [k, v] of Object.entries(rule.produces) as [keyof ResourceBag, number][]) out[k] = Number(v || 0) * lvl;
  return out;
}

/** Collects passive production for all player-owned buildings over elapsed seconds. */
export function collectProduction(world: EcsWorld, playerId: EntityId, sinceMs: number, ctx: SystemContext): Result<{ gained: ResourceBag }> {
  const seconds = Math.max(0, (ctx.now - sinceMs) / 1000);
  const gained: ResourceBag = {};
  for (const b of world.buildings.values()) {
    if (Number(b.owner || 0) !== playerId) continue;
    const perSecond = productionForBuilding(b.kind, b.level, ctx);
    for (const [k, v] of Object.entries(perSecond) as [keyof ResourceBag, number][]) gained[k] = Number(gained[k] || 0) + Number(v || 0) * seconds;
  }
  addBag(getInventory(world, playerId).resources, gained, ctx.rules.caps);
  addEvent(world, { t: ctx.now, entity: playerId, type: "collectProduction", data: { gained } });
  return ok({ gained });
}
