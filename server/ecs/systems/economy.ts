import type { EntityId, ResourceBag, SystemContext } from "../types.ts";
import { ok, type Result } from "../result.ts";

export function productionForBuilding(_kind: string, _level: number, _ctx: SystemContext): ResourceBag {
  // Stage 15 clean economy: buildings no longer grant passive resources.
  // Lumber camps, quarries, and farms spawn harvestable doodads through the
  // backend cleanEconomy tick instead.
  return {};
}

export function collectProduction(_world: unknown, _playerId: EntityId, _sinceMs: number, _ctx: SystemContext): Result<{ gained: ResourceBag }> {
  return ok({ gained: {} });
}
