import test from "node:test";
import assert from "node:assert/strict";
import { createClientWorldState } from "../clientStore.ts";
import { applySnapshot, snapshotSignature } from "../snapshotReducer.ts";

test("applySnapshot replaces world slices and merges peer updates", () => {
  const state = createClientWorldState();
  applySnapshot(state, {
    me: { id: 1, x: 0, z: 0 },
    world: {
      rev: 7,
      ax: 0,
      az: 0,
      tiles: [{ x: 0, z: 0, owner: 1 }],
      buildings: [{ uid: 10, x: 0, z: 0, kind: "farm" }],
      doodads: [],
      loot: [],
      players: [{ id: 2, x: 1, z: 1 }],
    },
    players: [{ id: 2, name: "Peer" }],
  });
  assert.equal(state.rev, 7);
  assert.equal(state.tiles.get("0,0")?.owner, 1);
  assert.equal(state.buildings.get(10)?.kind, "farm");
  assert.equal(state.players.get(2)?.name, "Peer");
});

test("snapshotSignature changes when visible counts change", () => {
  const state = createClientWorldState();
  const before = snapshotSignature(state);
  applySnapshot(state, { world: { rev: 1, tiles: [{ x: 1, z: 2 }] } });
  assert.notEqual(snapshotSignature(state), before);
});
