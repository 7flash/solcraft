import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, addPlayer, addDoodad, addLoot, DEFAULT_ECS_RULES, ecsContext } from "../index.ts";
import { harvestAt } from "../systems/harvest.ts";

test("harvestAt converts doodad to inventory resources", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Forager" }, { x: 0, z: 0 }, {}, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  addDoodad(world, { x: 1, z: 0, kind: "tree" });
  const r = harvestAt(world, 1, 1, 0, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.equal(world.inventories.get(1)?.resources.w, 3);
  assert.equal(world.doodads.has("1,0"), false);
});

test("harvestAt picks up loot without energy cost", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Forager" }, { x: 0, z: 0 }, {}, { value: 0, max: 10, regenPerMinute: 0, settledAt: 1 });
  addLoot(world, { x: 0, z: 1, resources: { g: 5 } });
  const r = harvestAt(world, 1, 0, 1, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.equal(world.inventories.get(1)?.resources.g, 5);
});
