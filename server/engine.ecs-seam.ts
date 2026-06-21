/**
 * Stage-1 migration seam.
 *
 * Do NOT point app/api/action at this file yet. Use it as the extraction seam
 * while moving cases out of game/engine.ts one at a time.
 *
 * Intended migration:
 * 1. Keep game/engine.ts exports unchanged.
 * 2. For one action at a time, adapt current DB rows into EcsWorld.
 * 3. Run dispatchEcs/makeSnapshot.
 * 4. Persist changed components back through the existing db tables.
 * 5. Delete the legacy helper only after parity tests pass.
 */
import { dispatchEcs, ecsContext, makeSnapshot, type EcsAction, type EcsWorld, type GameRules } from "./ecs/index.ts";

export function dispatchThroughEcs(world: EcsWorld, playerId: number, action: EcsAction, rules: GameRules, now = Date.now()) {
  return dispatchEcs(world, playerId, action, ecsContext(now, rules));
}

export function snapshotThroughEcs(world: EcsWorld, playerId: number, q: { rev?: number; ax?: number; az?: number; radius?: number }) {
  return makeSnapshot(world, playerId, q);
}
