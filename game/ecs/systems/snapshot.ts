import type { EcsWorld, EntityId } from "../types.ts";
import { cheb } from "../math.ts";

export type EcsSnapshot = {
  rev: number;
  me: unknown;
  world?: {
    ax: number;
    az: number;
    tiles: unknown[];
    buildings: unknown[];
    doodads: unknown[];
    loot: unknown[];
    players: unknown[];
  };
  events: unknown[];
};

export function makeSnapshot(world: EcsWorld, playerId: EntityId, q: { rev?: number; ax?: number; az?: number; radius?: number; eventsSince?: number } = {}): EcsSnapshot {
  const pos = world.positions.get(playerId) || { x: 0, z: 0 };
  const ax = Number.isFinite(Number(q.ax)) ? Number(q.ax) : pos.x;
  const az = Number.isFinite(Number(q.az)) ? Number(q.az) : pos.z;
  const radius = Math.max(4, Math.min(96, Number(q.radius || 48)));
  const me = {
    ...(world.players.get(playerId) || { id: playerId }),
    ...(world.positions.get(playerId) || {}),
    inv: world.inventories.get(playerId)?.resources || {},
    energy: world.energies.get(playerId) || null,
  };
  const base: EcsSnapshot = { rev: world.version, me, events: world.events.slice(-40) };
  if (Number(q.rev || 0) === world.version) return base;
  const near = (o: any) => cheb({ x: ax, z: az }, { x: Number(o.x || 0), z: Number(o.z || 0) }) <= radius;
  return {
    ...base,
    world: {
      ax, az,
      tiles: [...world.tiles.values()].filter(near),
      buildings: [...world.buildings.values()].filter(near),
      doodads: [...world.doodads.values()].filter(near),
      loot: [...world.loot.values()].filter(near),
      players: [...world.players.values()].map((p) => ({ ...p, ...(world.positions.get(p.id) || {}) })).filter(near),
    },
  };
}
