import type { EcsWorld, EntityId, SystemContext } from "../types.ts";
import { key, spendBag } from "../math.ts";
import { err, ok, type Result } from "../result.ts";
import { addEvent, getInventory, getTile, setTile } from "../world.ts";
import { spendEnergy } from "./energy.ts";

const N4 = [[1,0],[-1,0],[0,1],[0,-1]] as const;

export function ownsAdjacentTile(world: EcsWorld, playerId: EntityId, x: number, z: number): boolean {
  for (const [dx, dz] of N4) {
    const t = world.tiles.get(key((x | 0) + dx, (z | 0) + dz));
    if (Number(t?.owner || 0) === playerId) return true;
  }
  return false;
}

export function claimTile(world: EcsWorld, playerId: EntityId, x: number, z: number, ctx: SystemContext): Result<{ x: number; z: number; owner: number }> {
  x |= 0; z |= 0;
  const existing = getTile(world, x, z);
  if (existing?.owner === playerId) return ok({ x, z, owner: playerId });
  if (existing?.owner && existing.owner !== playerId) return err("Tile already claimed", "TILE_OWNED");
  const ownedCount = [...world.tiles.values()].filter((t) => Number(t.owner || 0) === playerId).length;
  if (ctx.rules.claim.requireAdjacentOwnedTile && ownedCount > 0 && !ownsAdjacentTile(world, playerId, x, z)) {
    return err("Claim next to your existing territory", "CLAIM_NOT_ADJACENT");
  }
  const inv = getInventory(world, playerId).resources;
  const energyCost = Number(ctx.rules.claim.cost.e || 0);
  if (energyCost > 0) {
    const spent = spendEnergy(world, playerId, energyCost, ctx.now);
    if (!spent.ok) return spent;
  }
  const cost = { ...ctx.rules.claim.cost };
  delete (cost as any).e;
  const paid = spendBag(inv, cost);
  if (paid !== true) return err("Not enough resources to claim", "CLAIM_COST", paid);
  setTile(world, { ...(existing || { x, z }), x, z, owner: playerId });
  addEvent(world, { t: ctx.now, entity: playerId, type: "claim", data: { x, z } });
  return ok({ x, z, owner: playerId });
}
