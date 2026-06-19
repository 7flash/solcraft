import test from "node:test";
import assert from "node:assert/strict";
import { ribbonIsAdvanced, ribbonModeForState, ribbonNeedsHorizontalScroll } from "./ribbonMode.ts";

test("ribbonModeForState maps primary gameplay ribbons", () => {
  assert.equal(ribbonModeForState({ mode: "build" }), "build");
  assert.equal(ribbonModeForState({ mode: "place" }), "build");
  assert.equal(ribbonModeForState({ tool: "use" }), "use");
});

test("ribbonModeForState maps secondary ribbons", () => {
  assert.equal(ribbonModeForState({ mode: "craft" }), "craft");
  assert.equal(ribbonModeForState({ tool: "spawn" }), "spawn");
  assert.equal(ribbonModeForState({ placing: "worldwonder" }), "wonder");
  assert.equal(ribbonModeForState({ mode: "admin" }), "admin");
});

test("ribbonModeForState keeps deterministic priority during legacy transitions", () => {
  assert.equal(ribbonModeForState({ mode: "build", tool: "wonder" }), "wonder");
  assert.equal(ribbonModeForState({ mode: "craft", tool: "admin" }), "admin");
  assert.equal(ribbonModeForState({ mode: "spawnPlace", tool: "use" }), "spawn");
});

test("ribbon helper flags separate scrolling content from advanced tools", () => {
  assert.equal(ribbonNeedsHorizontalScroll("build"), true);
  assert.equal(ribbonNeedsHorizontalScroll("wonder"), false);
  assert.equal(ribbonIsAdvanced("craft"), true);
  assert.equal(ribbonIsAdvanced("use"), false);
});
