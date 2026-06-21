import type { BuildingC, EcsWorld, PlayerC, ResourceBag, TileC } from "../types.ts";
import { addBuilding, addPlayer, createWorld, setTile } from "../world.ts";

/**
 * Adapter helpers for the current sqlite-zod-orm row shapes.
 * These functions intentionally accept `any` because the legacy ORM rows are
 * mutable objects and not yet exported as stable DTO types.
 */
export function playerRowToComponents(row: any): { player: PlayerC; pos: { x: number; z: number }; inv: ResourceBag; energy: any } {
  return {
    player: {
      id: Number(row?.id || 0),
      name: String(row?.name || "Player"),
      spectator: !!row?.spectator,
      level: Number(row?.level || 1),
      hp: Number(row?.hp || 0),
      spawnX: Number(row?.spawnX || 0),
      spawnZ: Number(row?.spawnZ || 0),
    },
    pos: { x: Number(row?.x || 0), z: Number(row?.z || 0) },
    inv: normalizeInv(row?.inv || {}),
    energy: {
      value: Number(row?.energy ?? row?.e ?? 100),
      max: Number(row?.maxE ?? row?.energyMax ?? 100),
      regenPerMinute: Number(row?.energyRegenPerMinute ?? 80),
      settledAt: Number(row?.energyAt ?? row?.settledAt ?? Date.now()),
    },
  };
}

export function tileRowToComponent(row: any): TileC {
  return { id: Number(row?.id || 0), x: Number(row?.x || 0), z: Number(row?.z || 0), owner: Number(row?.owner || 0), biome: row?.biome, hp: Number(row?.hp || 0) };
}

export function buildingRowToComponent(row: any): BuildingC {
  return {
    id: Number(row?.id || row?.uid || 0),
    uid: Number(row?.uid || row?.id || 0),
    kind: String(row?.kind || ""),
    owner: Number(row?.owner || 0),
    x: Number(row?.x || 0),
    z: Number(row?.z || 0),
    level: Number(row?.level || 1),
    hp: Number(row?.hp || 0),
    maxHp: Number(row?.maxHp || 0),
    stored: normalizeInv(row?.stored || {}),
    builtAt: Number(row?.builtAt || 0),
    readyAt: Number(row?.readyAt || 0),
  };
}

export function rowsToWorld(rows: { players?: any[]; tiles?: any[]; buildings?: any[]; doodads?: any[]; loot?: any[] } = {}): EcsWorld {
  const world = createWorld();
  for (const row of rows.players || []) {
    const p = playerRowToComponents(row);
    addPlayer(world, p.player, p.pos, p.inv, p.energy);
  }
  for (const row of rows.tiles || []) setTile(world, tileRowToComponent(row));
  for (const row of rows.buildings || []) addBuilding(world, buildingRowToComponent(row));
  for (const row of rows.doodads || []) world.doodads.set(`${Number(row.x || 0)},${Number(row.z || 0)}`, { x: Number(row.x || 0), z: Number(row.z || 0), kind: String(row.kind || row.k || "tree"), amount: Number(row.amount || 1) });
  for (const row of rows.loot || []) world.loot.set(`${Number(row.x || 0)},${Number(row.z || 0)}`, { id: Number(row.id || 0), x: Number(row.x || 0), z: Number(row.z || 0), resources: normalizeInv(row.resources || row.inv || row) });
  return world;
}

function normalizeInv(input: any): ResourceBag {
  const out: ResourceBag = {};
  for (const key of ["e", "w", "p", "s", "f", "g", "sh", "sc"] as const) {
    const n = Number(input?.[key] || 0);
    if (Number.isFinite(n) && n !== 0) out[key] = n;
  }
  return out;
}
