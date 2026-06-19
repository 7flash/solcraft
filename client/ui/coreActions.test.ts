import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ACTIONS } from "./coreActions.ts";

test("core bottom bar is a five-slot toolbelt", () => {
  assert.equal(CORE_ACTIONS.length, 5);
  assert.deepEqual(CORE_ACTIONS.map((a) => a.label), ["Axe", "Pickaxe", "Hammer", "Shovel", "Capture"]);
  assert.deepEqual(CORE_ACTIONS.map((a) => a.key), [1, 2, 3, 4, 5]);
});

test("toolbelt slots directly map to cursor/tool clicks", () => {
  assert.deepEqual(CORE_ACTIONS.map((a) => a.click), ["gather-wood", "gather-stone", "select-build", "demolish-tool", "capture-tool"]);
  assert.deepEqual(CORE_ACTIONS.map((a) => a.cursor), ["axe", "pickaxe", "hammer", "shovel", "capture"]);
});

test("menus and travel are not bottom toolbelt slots", () => {
  const labels = CORE_ACTIONS.map((a) => a.label.toLowerCase());
  for (const forbidden of ["bank", "more", "wonder", "teleport", "tools", "move"]) {
    assert.equal(labels.includes(forbidden), false);
  }
});
