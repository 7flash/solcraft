import type { EcsWorld, EntityId, Millis } from "../types.ts";
import { err, ok, type Result } from "../result.ts";

export function settleEnergy(world: EcsWorld, playerId: EntityId, now: Millis): number {
  const e = world.energies.get(playerId);
  if (!e) return 0;
  const elapsed = Math.max(0, now - Number(e.settledAt || now));
  if (elapsed > 0 && e.regenPerMinute > 0) {
    e.value = Math.min(e.max, Number(e.value || 0) + elapsed * e.regenPerMinute / 60000);
    e.settledAt = now;
  }
  return e.value;
}

export function spendEnergy(world: EcsWorld, playerId: EntityId, amount: number, now: Millis): Result<{ energy: number }> {
  const e = world.energies.get(playerId);
  if (!e) return err("Missing energy component", "MISSING_ENERGY");
  settleEnergy(world, playerId, now);
  const cost = Math.max(0, Number(amount || 0));
  if (e.value + 1e-9 < cost) return err("Not enough energy", "ENERGY_LOW", { need: cost, have: e.value });
  e.value -= cost;
  e.settledAt = now;
  return ok({ energy: e.value });
}
