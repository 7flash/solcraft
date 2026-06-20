
import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_CATALOG, CURSOR_IDS, TOOL_ATLAS_ROWS, TOOL_ATLAS_SLOTS, atlasEntry, atlasRuntimeDefaults } from "./atlasCatalog.ts";

test("tool atlas has toolbelt, hand, and active tool cursor rows", () => {
  assert.equal(ATLAS_CATALOG.tool.cols, 5);
  assert.equal(ATLAS_CATALOG.tool.rows, 3);
  assert.deepEqual(TOOL_ATLAS_ROWS.map((row) => row.id), ["bar", "hand", "cursor"]);
  assert.equal(TOOL_ATLAS_SLOTS[0], "bar.axe");
  assert.equal(TOOL_ATLAS_SLOTS[7], "hand.hammer");
  assert.equal(TOOL_ATLAS_SLOTS[12], "cursor.hammer");
  assert.equal(TOOL_ATLAS_SLOTS[14], "cursor.capture");
});

test("runtime defaults include the new tool atlas", () => {
  assert.equal(atlasEntry("tool")?.runtimeFile, "tool_atlas_clean.png");
  assert.equal(atlasRuntimeDefaults().tool, "procedural");
});


test("cursor atlas covers neutral and non-tool cursors", () => {
  assert.equal(ATLAS_CATALOG.cursor.cols, 6);
  assert.equal(ATLAS_CATALOG.cursor.rows, 2);
  assert.equal(atlasRuntimeDefaults().cursor, "procedural");
  assert.equal(atlasEntry("cursor")?.runtimeFile, "cursor_atlas_clean.png");
  assert.deepEqual(CURSOR_IDS.slice(0, 4), ["default", "walk", "inspect", "interact"]);
  assert.ok(CURSOR_IDS.includes("wait"));
  assert.ok(CURSOR_IDS.includes("pin"));
});


test("all runtime atlases default to fallback/procedural while art is regenerated", () => {
  const defaults = atlasRuntimeDefaults();
  for (const id of Object.keys(defaults)) assert.equal(defaults[id], "procedural");
});
