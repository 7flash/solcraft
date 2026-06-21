import { describe, expect, test } from "bun:test";
import { dispatchEcs, ecsContext, type EcsAction } from "./dispatch.ts";
import { runParitySuite } from "./parityHarness.ts";
import { createWorld, addPlayer, setTile } from "./world.ts";
import type { EcsWorld } from "./types.ts";
import { DEFAULT_ECS_RULES } from "./tuning.ts";

function fixture() {
  const world = createWorld();
  addPlayer(world, { id: 1, name: "Parity" }, { x: 0, z: 0 }, { w: 100, s: 100, f: 100 }, { value: 100, max: 100, regenPerMinute: 0, settledAt: 1000 });
  setTile(world, { x: 0, z: 0, owner: 1 });
  setTile(world, { x: 1, z: 0, owner: 1 });
  return world;
}

function sortedEntries<T>(m: Map<any, T>) {
  return Array.from(m.entries()).sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function projectWorld(world: EcsWorld) {
  return {
    version: world.version,
    positions: sortedEntries(world.positions),
    inventories: sortedEntries(world.inventories),
    energies: sortedEntries(world.energies),
    tiles: sortedEntries(world.tiles),
    buildings: sortedEntries(world.buildings),
    buildingAt: sortedEntries(world.buildingAt),
    events: world.events.map((e) => ({ ...e })),
  };
}

const runner = (world: EcsWorld, playerId: number, action: EcsAction) => dispatchEcs(world, playerId, action, ecsContext(1000, DEFAULT_ECS_RULES));

describe("ecs action parity fixtures", () => {
  test("fixture suite can compare cloned ECS worlds with Map state", () => {
    const cases = [
      { name: "move one step", state: fixture(), playerId: 1, action: { type: "move", x: 1, z: 0 }, project: projectWorld },
      { name: "claim adjacent", state: fixture(), playerId: 1, action: { type: "claim", x: 0, z: 1 }, project: projectWorld },
      { name: "place owned building", state: fixture(), playerId: 1, action: { type: "place", kind: "cottage", x: 1, z: 0 }, project: projectWorld },
    ];
    const suite = runParitySuite(cases, runner, runner);
    expect(suite.ok).toBe(true);
    expect(suite.passed).toBe(cases.length);
  });
});
