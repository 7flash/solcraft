import type { ClientSnapshot, ClientWorldDelta, ClientWorldState } from "./types.ts";
import { buildingKey, coordKey, playerKey } from "./keys.ts";

export function applySnapshot(state: ClientWorldState, snap: ClientSnapshot): ClientWorldState {
  if (snap.me) state.me = { ...(state.me || {}), ...snap.me };
  const world = snap.world;
  if (world) {
    state.rev = Number(world.rev || snap.rev || state.rev || 0);
    if (Number.isFinite(Number(world.ax)) && Number.isFinite(Number(world.az))) {
      state.anchor = { x: Number(world.ax), z: Number(world.az) };
    }

    // Full arrays remain replace-only for backwards compatibility.
    if (Array.isArray(world.tiles)) state.tiles = replaceByCoord(world.tiles);
    if (Array.isArray(world.doodads)) state.doodads = replaceByCoord(world.doodads);
    if (Array.isArray(world.loot)) state.loot = replaceByCoord(world.loot);
    if (Array.isArray(world.buildings)) state.buildings = replaceById(world.buildings, buildingKey);
    if (Array.isArray(world.players)) state.players = replaceById(world.players, playerKey);

    // Delta snapshots merge in place and support explicit tombstones/removals.
    // The server may emit either world.delta, world.changes, or flat aliases
    // during the migration window.
    const delta = (world.delta || world.changes || world) as ClientWorldDelta;
    applyWorldDelta(state, delta);
  }
  if (Array.isArray(snap.players)) {
    for (const p of snap.players) {
      const id = playerKey(p);
      if (id) state.players.set(id, { ...(state.players.get(id) || {}), ...p });
    }
  }
  if (Array.isArray(snap.events)) state.events = snap.events.slice(-80);
  if (Array.isArray(snap.chat)) state.chat = snap.chat.slice(-80);
  return state;
}

export function applyWorldDelta(state: ClientWorldState, delta: ClientWorldDelta | null | undefined): ClientWorldState {
  if (!delta) return state;
  if (Number.isFinite(Number(delta.rev))) state.rev = Math.max(state.rev || 0, Number(delta.rev));
  if (Number.isFinite(Number(delta.ax)) && Number.isFinite(Number(delta.az))) {
    state.anchor = { x: Number(delta.ax), z: Number(delta.az) };
  }

  applyCoordDelta(state.tiles, delta.tiles?.upsert ?? delta.tilesUpsert, delta.tiles?.remove ?? delta.tiles?.removed ?? delta.tilesRemove);
  applyCoordDelta(state.doodads, delta.doodads?.upsert ?? delta.doodadsUpsert, delta.doodads?.remove ?? delta.doodads?.removed ?? delta.doodadsRemove);
  applyCoordDelta(state.loot, delta.loot?.upsert ?? delta.lootUpsert, delta.loot?.remove ?? delta.loot?.removed ?? delta.lootRemove);
  applyIdDelta(state.buildings, delta.buildings?.upsert ?? delta.buildingsUpsert, delta.buildings?.remove ?? delta.buildings?.removed ?? delta.buildingsRemove, buildingKey);
  applyIdDelta(state.players, delta.players?.upsert ?? delta.playersUpsert, delta.players?.remove ?? delta.players?.removed ?? delta.playersRemove, playerKey);
  return state;
}

function replaceByCoord(items: any[]): Map<string, any> {
  const m = new Map<string, any>();
  for (const item of items) m.set(coordKey(Number(item?.x || 0), Number(item?.z || 0)), item);
  return m;
}

function replaceById(items: any[], getId: (item: any) => number): Map<number, any> {
  const m = new Map<number, any>();
  for (const item of items) {
    const id = getId(item);
    if (id) m.set(id, item);
  }
  return m;
}

function coordRemoveKey(item: any): string {
  if (typeof item === "string") return item;
  if (Array.isArray(item)) return coordKey(Number(item[0] || 0), Number(item[1] || 0));
  return coordKey(Number(item?.x || 0), Number(item?.z || 0));
}

function applyCoordDelta(map: Map<string, any>, upsert?: any[], remove?: any[]) {
  if (Array.isArray(remove)) {
    for (const item of remove) {
      const k = coordRemoveKey(item);
      if (k) map.delete(k);
    }
  }
  if (Array.isArray(upsert)) {
    for (const item of upsert) {
      const k = coordKey(Number(item?.x || 0), Number(item?.z || 0));
      map.set(k, { ...(map.get(k) || {}), ...item });
    }
  }
}

function idRemoveKey(item: any, getId: (item: any) => number): number {
  if (typeof item === "number") return item;
  if (typeof item === "string") return Number(item) || 0;
  return getId(item);
}

function applyIdDelta(map: Map<number, any>, upsert: any[] | undefined, remove: any[] | undefined, getId: (item: any) => number) {
  if (Array.isArray(remove)) {
    for (const item of remove) {
      const id = idRemoveKey(item, getId);
      if (id) map.delete(id);
    }
  }
  if (Array.isArray(upsert)) {
    for (const item of upsert) {
      const id = getId(item);
      if (id) map.set(id, { ...(map.get(id) || {}), ...item });
    }
  }
}

/**
 * Cheap coarse signature. Do not use this as the only gate for in-place world
 * updates; delta snapshots intentionally mutate existing entity counts.
 */
export function snapshotSignature(state: ClientWorldState): string {
  return [
    state.rev,
    state.me?.id || 0,
    state.me?.x || 0,
    state.me?.z || 0,
    state.tiles.size,
    state.buildings.size,
    state.doodads.size,
    state.loot.size,
    state.players.size,
    state.events.length,
  ].join(":");
}
