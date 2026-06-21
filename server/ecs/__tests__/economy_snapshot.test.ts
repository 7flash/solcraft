import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, addPlayer, setTile, DEFAULT_ECS_RULES, ecsContext } from "../index.ts";
import { placeBuilding } from "../systems/building.ts";
import { collectProduction } from "../systems/economy.ts";
import { makeSnapshot } from "../systems/snapshot.ts";

test("collectProduction aggregates player-owned buildings", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Maker" }, { x: 0, z: 0 }, { w: 100, s: 100, f: 100 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  placeBuilding(world, 1, "farm", 0, 0, ecsContext(1000, DEFAULT_ECS_RULES));
  const r = collectProduction(world, 1, 1000, ecsContext(11000, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.ok(Number(world.inventories.get(1)?.resources.f || 0) > 100);
});

test("makeSnapshot skips world payload when revision matches", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Watcher" }, { x: 0, z: 0 }, {}, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  const full = makeSnapshot(world, 1, { rev: 0 });
  assert.ok(full.world);
  const delta = makeSnapshot(world, 1, { rev: world.version });
  assert.equal(delta.world, undefined);
});
