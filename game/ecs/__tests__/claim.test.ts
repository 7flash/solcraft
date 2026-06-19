import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, addPlayer, setTile, DEFAULT_ECS_RULES, ecsContext } from "../index.ts";
import { claimTile } from "../systems/claim.ts";

test("claimTile allows first claim without adjacency", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Builder" }, { x: 0, z: 0 }, { w: 10, s: 10 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  const r = claimTile(world, 1, 0, 0, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.equal(world.tiles.get("0,0")?.owner, 1);
  assert.equal(world.inventories.get(1)?.resources.w, 8);
});

test("claimTile enforces adjacency after first territory", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Builder" }, { x: 0, z: 0 }, { w: 20, s: 20 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  const r = claimTile(world, 1, 5, 5, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(r.ok, false);
  assert.equal((r as any).reasonCode, "CLAIM_NOT_ADJACENT");
});

 test("claimTile rejects enemy-owned tiles", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Builder" }, { x: 0, z: 0 }, { w: 20, s: 20 }, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1 });
  setTile(world, { x: 0, z: 0, owner: 2 });
  const r = claimTile(world, 1, 0, 0, ecsContext(1, DEFAULT_ECS_RULES));
  assert.equal(r.ok, false);
  assert.equal((r as any).reasonCode, "TILE_OWNED");
});
