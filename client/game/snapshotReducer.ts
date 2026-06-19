import type { ClientSnapshot, ClientWorldState } from "./types.ts";
import { buildingKey, coordKey, playerKey } from "./keys.ts";

export function applySnapshot(state: ClientWorldState, snap: ClientSnapshot): ClientWorldState {
  if (snap.me) state.me = { ...(state.me || {}), ...snap.me };
  const world = snap.world;
  if (world) {
    state.rev = Number(world.rev || snap.rev || state.rev || 0);
    if (Number.isFinite(Number(world.ax)) && Number.isFinite(Number(world.az))) {
      state.anchor = { x: Number(world.ax), z: Number(world.az) };
    }
    if (Array.isArray(world.tiles)) state.tiles = replaceByCoord(world.tiles);
    if (Array.isArray(world.doodads)) state.doodads = replaceByCoord(world.doodads);
    if (Array.isArray(world.loot)) state.loot = replaceByCoord(world.loot);
    if (Array.isArray(world.buildings)) state.buildings = replaceById(world.buildings, buildingKey);
    if (Array.isArray(world.players)) state.players = replaceById(world.players, playerKey);
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
