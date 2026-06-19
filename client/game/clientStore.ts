import type { ClientWorldState } from "./types.ts";

export function createClientWorldState(): ClientWorldState {
  return {
    rev: 0,
    anchor: { x: 0, z: 0 },
    me: null,
    tiles: new Map(),
    buildings: new Map(),
    doodads: new Map(),
    loot: new Map(),
    players: new Map(),
    events: [],
    chat: [],
  };
}

export function cloneClientWorldState(s: ClientWorldState): ClientWorldState {
  return {
    rev: s.rev,
    anchor: { ...s.anchor },
    me: s.me ? { ...s.me } : null,
    tiles: new Map(s.tiles),
    buildings: new Map(s.buildings),
    doodads: new Map(s.doodads),
    loot: new Map(s.loot),
    players: new Map(s.players),
    events: s.events.slice(),
    chat: s.chat.slice(),
  };
}
