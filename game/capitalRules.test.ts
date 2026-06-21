import test from "node:test";
import assert from "node:assert/strict";
import { capitalBlocksNaturalResource, capitalBlocksPlayerTerritory, keepCrossIndexAt, keepCrossPositionsInBox, settlementSpawnAllowed } from "./capitalRules.ts";

test("capital core blocks player territory and service zone blocks natural resources", () => {
  assert.equal(capitalBlocksPlayerTerritory(0, 0), true);
  assert.equal(capitalBlocksPlayerTerritory(9, 0), false);
  assert.equal(capitalBlocksNaturalResource(11, 0), true);
  assert.equal(capitalBlocksNaturalResource(13, 0), false);
});

test("new settlements start outside the capital reserve", () => {
  assert.equal(settlementSpawnAllowed(14, 0), false);
  assert.equal(settlementSpawnAllowed(16, 0), true);
  assert.equal(settlementSpawnAllowed(20, 20), true);
});

test("keeps live on a cross expanding from the capital", () => {
  assert.deepEqual(keepCrossIndexAt(0, -28), { lane: "north", index: 0, distance: 28 });
  assert.equal(keepCrossIndexAt(28, 28), null);
  assert.equal(keepCrossIndexAt(0, -29), null);
  const near = keepCrossPositionsInBox(0, 0, 30).map((p) => `${p.x},${p.z}`).sort();
  assert.deepEqual(near, ["-28,0", "0,-28", "0,28", "28,0"]);
});
