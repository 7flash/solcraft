import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, addPlayer, DEFAULT_ECS_RULES, ecsContext, moveEntity, movePath } from "../index.ts";

test("moveEntity moves one chebyshev step and spends energy", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Ada" }, { x: 0, z: 0 }, {}, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1000 });
  const r = moveEntity(world, 1, 1, 1, ecsContext(1000, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.deepEqual(world.positions.get(1), { x: 1, z: 1 });
  assert.equal(Number(world.energies.get(1)?.value.toFixed(2)), 9.92);
});

test("moveEntity rejects long jumps", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Ada" }, { x: 0, z: 0 }, {}, { value: 10, max: 10, regenPerMinute: 0, settledAt: 1000 });
  const r = moveEntity(world, 1, 3, 0, ecsContext(1000, DEFAULT_ECS_RULES));
  assert.equal(r.ok, false);
  assert.equal((r as any).reasonCode, "MOVE_TOO_FAR");
  assert.deepEqual(world.positions.get(1), { x: 0, z: 0 });
});

test("movePath stops cleanly when energy runs out", () => {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Ada" }, { x: 0, z: 0 }, {}, { value: 0.1, max: 1, regenPerMinute: 0, settledAt: 1000 });
  const r = movePath(world, 1, [{ x: 1, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 0 }], ecsContext(1000, DEFAULT_ECS_RULES));
  assert.equal(r.ok, true);
  assert.equal((r as any).moved, 1);
  assert.deepEqual(world.positions.get(1), { x: 1, z: 0 });
});
