import test from "node:test";
import assert from "node:assert/strict";
import { capitalBlocksNaturalResource, capitalBlocksPlayerTerritory, keepCrossIndexAt, keepCrossPositionsInBox, settlementSpawnAllowed, settlementSpawnPoint, settlementSpawnPositions } from "./capitalRules.ts";

test("capital core blocks player territory and service zone blocks natural resources", () => {
  assert.equal(capitalBlocksPlayerTerritory(0, 0), true);
  assert.equal(capitalBlocksPlayerTerritory(9, 0), false);
  assert.equal(capitalBlocksNaturalResource(11, 0), true);
  assert.equal(capitalBlocksNaturalResource(13, 0), false);
});

test("new settlements start well outside the capital gates", () => {
  assert.equal(settlementSpawnAllowed(20, 0), false);
  assert.equal(settlementSpawnAllowed(28, 0), true);
  assert.equal(settlementSpawnAllowed(32, 32), true);
});

test("settlement spawns use four fair player arms", () => {
  assert.deepEqual(settlementSpawnPoint(0), { lane: "east", ring: 0, x: 28, z: 9 });
  assert.deepEqual(settlementSpawnPoint(1), { lane: "south", ring: 0, x: -9, z: 28 });
  assert.deepEqual(settlementSpawnPoint(2), { lane: "west", ring: 0, x: -28, z: -9 });
  assert.deepEqual(settlementSpawnPoint(3), { lane: "north", ring: 0, x: 9, z: -28 });
  assert.equal(new Set(settlementSpawnPositions(12).map((p) => `${p.x},${p.z}`)).size, 12);
});

test("keeps live in diagonal wilderness lanes farther from the capital", () => {
  assert.deepEqual(keepCrossIndexAt(42, -42), { lane: "northeast", index: 0, distance: 42 });
  assert.equal(keepCrossIndexAt(42, 0), null);
  assert.equal(keepCrossIndexAt(42, -43), null);
  const near = keepCrossPositionsInBox(0, 0, 43).map((p) => `${p.x},${p.z}`).sort();
  assert.deepEqual(near, ["-42,-42", "-42,42", "42,-42", "42,42"]);
});
