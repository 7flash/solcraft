import type { BuildingC, Coord, DoodadC, EcsEvent, EcsWorld, EntityId, InventoryC, LootC, PlayerC, ResourceBag, TileC } from "./types.ts";
import { key } from "./math.ts";

export function createWorld(): EcsWorld {
  return {
    version: 1,
    nextEntityId: 1,
    players: new Map(),
    positions: new Map(),
    inventories: new Map(),
    energies: new Map(),
    tiles: new Map(),
    buildings: new Map(),
    buildingAt: new Map(),
    doodads: new Map(),
    loot: new Map(),
    events: [],
  };
}

export function bump(world: EcsWorld): void { world.version += 1; }
export function alloc(world: EcsWorld): EntityId { return world.nextEntityId++; }

export function addEvent(world: EcsWorld, event: EcsEvent): void {
  world.events.push(event);
  if (world.events.length > 300) world.events.splice(0, world.events.length - 300);
}

export function addPlayer(world: EcsWorld, player: PlayerC, pos: Coord, inv: ResourceBag = {}, energy?: Partial<{ value: number; max: number; regenPerMinute: number; settledAt: number }>): EntityId {
  const id = player.id || alloc(world);
  world.players.set(id, { ...player, id });
  world.positions.set(id, { x: pos.x | 0, z: pos.z | 0 });
  world.inventories.set(id, { resources: { ...inv } });
  world.energies.set(id, {
    value: Number(energy?.value ?? energy?.max ?? 100),
    max: Number(energy?.max ?? 100),
    regenPerMinute: Number(energy?.regenPerMinute ?? 80),
    settledAt: Number(energy?.settledAt ?? 0),
  });
  world.nextEntityId = Math.max(world.nextEntityId, id + 1);
  return id;
}

export function getInventory(world: EcsWorld, id: EntityId): InventoryC {
  let inv = world.inventories.get(id);
  if (!inv) {
    inv = { resources: {} };
    world.inventories.set(id, inv);
  }
  return inv;
}

export function getTile(world: EcsWorld, x: number, z: number): TileC | undefined { return world.tiles.get(key(x, z)); }
export function setTile(world: EcsWorld, tile: TileC): void { world.tiles.set(key(tile.x, tile.z), { ...tile }); bump(world); }

export function addDoodad(world: EcsWorld, doodad: DoodadC): void { world.doodads.set(key(doodad.x, doodad.z), { ...doodad }); bump(world); }
export function addLoot(world: EcsWorld, loot: LootC): void { world.loot.set(key(loot.x, loot.z), { ...loot }); bump(world); }

export function addBuilding(world: EcsWorld, b: BuildingC): EntityId {
  const uid = b.uid || alloc(world);
  const next = { ...b, uid };
  world.buildings.set(uid, next);
  world.buildingAt.set(key(next.x, next.z), uid);
  world.nextEntityId = Math.max(world.nextEntityId, uid + 1);
  bump(world);
  return uid;
}

export function buildingAt(world: EcsWorld, x: number, z: number): BuildingC | undefined {
  const uid = world.buildingAt.get(key(x, z));
  return uid == null ? undefined : world.buildings.get(uid);
}

export function removeBuilding(world: EcsWorld, uid: EntityId): BuildingC | undefined {
  const b = world.buildings.get(uid);
  if (!b) return undefined;
  world.buildings.delete(uid);
  world.buildingAt.delete(key(b.x, b.z));
  bump(world);
  return b;
}
