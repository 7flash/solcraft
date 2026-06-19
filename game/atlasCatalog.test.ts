
import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_CATALOG, TOOL_ATLAS_ROWS, TOOL_ATLAS_SLOTS, atlasEntry, atlasRuntimeDefaults } from "./atlasCatalog.ts";

test("tool atlas has bottom bar, hand, cursor, and affordance rows", () => {
  assert.equal(ATLAS_CATALOG.tool.cols, 5);
  assert.equal(ATLAS_CATALOG.tool.rows, 4);
  assert.deepEqual(TOOL_ATLAS_ROWS.map((row) => row.id), ["bar", "hand", "cursor", "affordance"]);
  assert.equal(TOOL_ATLAS_SLOTS[0], "bar.axe");
  assert.equal(TOOL_ATLAS_SLOTS[7], "hand.hammer");
  assert.equal(TOOL_ATLAS_SLOTS[12], "cursor.hammer");
  assert.equal(TOOL_ATLAS_SLOTS[19], "affordance.capture");
});

test("runtime defaults include the new tool atlas", () => {
  assert.equal(atlasEntry("tool")?.runtimeFile, "tool_atlas_clean.png");
  assert.equal(atlasRuntimeDefaults().tool, "atlas");
});
