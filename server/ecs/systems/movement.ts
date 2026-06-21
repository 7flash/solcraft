import type { EcsWorld, EntityId, SystemContext } from "../types.ts";
import { cheb } from "../math.ts";
import { err, ok, type Result } from "../result.ts";
import { bump, addEvent } from "../world.ts";
import { spendEnergy } from "./energy.ts";

export function moveEntity(world: EcsWorld, entityId: EntityId, x: number, z: number, ctx: SystemContext): Result<{ x: number; z: number; energy: number }> {
  const player = world.players.get(entityId);
  if (!player) return err("Unknown player", "PLAYER_NOT_FOUND");
  if (player.spectator) return err("Spectators cannot move", "SPECTATOR");
  const from = world.positions.get(entityId);
  if (!from) return err("Missing position", "MISSING_POSITION");
  const to = { x: x | 0, z: z | 0 };
  const d = cheb(from, to);
  if (d < 1) return ok({ x: from.x, z: from.z, energy: world.energies.get(entityId)?.value || 0 });
  if (d > ctx.rules.movement.maxChebStep) return err("Move one tile at a time", "MOVE_TOO_FAR", { from, to });
  const spent = spendEnergy(world, entityId, ctx.rules.movement.energyPerStep * d, ctx.now);
  if (!spent.ok) return spent;
  world.positions.set(entityId, to);
  bump(world);
  addEvent(world, { t: ctx.now, entity: entityId, type: "move", data: to });
  return ok({ x: to.x, z: to.z, energy: spent.energy });
}

export function movePath(world: EcsWorld, entityId: EntityId, steps: { x: number; z: number }[], ctx: SystemContext): Result<{ x: number; z: number; moved: number }> {
  let moved = 0;
  for (const step of steps.slice(0, 32)) {
    const r = moveEntity(world, entityId, step.x, step.z, ctx);
    if (!r.ok) return moved ? ok({ ...(world.positions.get(entityId) || { x: 0, z: 0 }), moved }) : r;
    moved += 1;
  }
  return ok({ ...(world.positions.get(entityId) || { x: 0, z: 0 }), moved });
}
