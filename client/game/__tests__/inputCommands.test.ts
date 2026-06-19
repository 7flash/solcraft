import test from "node:test";
import assert from "node:assert/strict";
import { commandForBuildingClick, commandForTileClick } from "../inputCommands.ts";

test("commandForTileClick maps modes to existing API actions", () => {
  assert.deepEqual(commandForTileClick("claim", { x: 1, z: 2 }), { type: "claim", x: 1, z: 2 });
  assert.deepEqual(commandForTileClick("build", { x: 1, z: 2 }, { kind: "farm" }), { type: "place", kind: "farm", x: 1, z: 2 });
  assert.deepEqual(commandForTileClick("move", { x: 1, z: 2 }), { type: "move", x: 1, z: 2 });
});

test("commandForBuildingClick preserves legacy action names", () => {
  assert.deepEqual(commandForBuildingClick("upgrade", { uid: 5 }), { type: "upgrade", uid: 5 });
  assert.deepEqual(commandForBuildingClick("demolish", { id: 6 }), { type: "demolish", uid: 6 });
});
