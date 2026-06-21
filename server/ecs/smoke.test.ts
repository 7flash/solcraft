import { describe, expect, test } from "bun:test";
import { dispatchEcs, ecsContext } from "./dispatch.ts";
import { createWorld, addPlayer, setTile } from "./world.ts";
import { DEFAULT_ECS_RULES } from "./tuning.ts";

function fixture() {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Tester" }, { x: 0, z: 0 }, { w: 100, s: 100, f: 100 }, { value: 100, max: 100, regenPerMinute: 0, settledAt: 1000 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  return world;
}

describe("ecs smoke", () => {
  test("moves one tile and spends energy", () => {
    const world = fixture();
    const result = dispatchEcs(world, 1, { type: "move", x: 1, z: 0 }, ecsContext(1000, DEFAULT_ECS_RULES));
    expect(result.ok).toBe(true);
    expect(world.positions.get(1)).toEqual({ x: 1, z: 0 });
    expect(world.energies.get(1)?.value).toBeLessThan(100);
  });

  test("claims adjacent tile and spends resources", () => {
    const world = fixture();
    const result = dispatchEcs(world, 1, { type: "claim", x: 1, z: 0 }, ecsContext(1000, DEFAULT_ECS_RULES));
    expect(result.ok).toBe(true);
    expect(world.tiles.get("1,0")?.owner).toBe(1);
    expect(world.inventories.get(1)?.resources.w).toBeLessThan(100);
  });

  test("places a building on owned tile", () => {
    const world = fixture();
    setTile(world, { x: 1, z: 0, owner: 1 });
    const result = dispatchEcs(world, 1, { type: "place", kind: "cottage", x: 1, z: 0 }, ecsContext(1000, DEFAULT_ECS_RULES));
    expect(result.ok).toBe(true);
    const uid = world.buildingAt.get("1,0");
    expect(uid).toBeTruthy();
    expect(world.buildings.get(uid!)?.kind).toBe("cottage");
  });
});
