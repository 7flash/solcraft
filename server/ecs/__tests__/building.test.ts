import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, addPlayer, setTile, DEFAULT_ECS_RULES, ecsContext } from "../index.ts";
import { placeBuilding, upgradeBuilding, demolishBuilding } from "../systems/building.ts";

test("placeBuilding requires owned tile and spends resources", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Mason" }, { x: 0, z: 0 }, { w: 100, s: 100, f: 100 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  const r = placeBuilding(world, 1, "farm", 0, 0, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.equal(world.buildings.size, 1);
  assert.equal(world.inventories.get(1)?.resources.w, 92);
});

test("upgradeBuilding raises level with scaled cost", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Mason" }, { x: 0, z: 0 }, { w: 100, s: 100, f: 100 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  const placed = placeBuilding(world, 1, "farm", 0, 0, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(placed.ok, true);
  const uid = (placed as any).uid;
  const upgraded = upgradeBuilding(world, 1, uid, ecsContext(2, DEFAULT_ECS_RULES));
  assert.equal(upgraded.ok, true);
  assert.equal(world.buildings.get(uid)?.level, 2);
});

test("demolishBuilding removes coordinate occupancy", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Mason" }, { x: 0, z: 0 }, { w: 100, s: 100, f: 100 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  const placed = placeBuilding(world, 1, "farm", 0, 0, ecsContext(1, DEFAULT_ECS_RULES));
  const uid = (placed as any).uid;
  const r = demolishBuilding(world, 1, uid, ecsContext(3, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.equal(world.buildings.size, 0);
  assert.equal(world.buildingAt.has("0,0"), false);
});
