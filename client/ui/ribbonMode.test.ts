import test from "node:test";
import assert from "node:assert/strict";
import { ribbonIsAdvanced, ribbonModeForState, ribbonNeedsHorizontalScroll } from "./ribbonMode.ts";

test("ribbonModeForState maps build/placement to the top building ribbon", () => {
  assert.equal(ribbonModeForState({ mode: "build" }), "build");
  assert.equal(ribbonModeForState({ mode: "place" }), "build");
  assert.equal(ribbonModeForState({ tool: "build" }), "build");
});

test("direct toolbelt tools do not open nested ribbons", () => {
  assert.equal(ribbonModeForState({ tool: "wood" }), null);
  assert.equal(ribbonModeForState({ tool: "stone" }), null);
  assert.equal(ribbonModeForState({ mode: "demolish", tool: "demolish" }), null);
  assert.equal(ribbonModeForState({ tool: "claim" }), null);
});

test("legacy secondary ribbons remain addressable outside the toolbelt", () => {
  assert.equal(ribbonModeForState({ mode: "tools" }), "tools");
  assert.equal(ribbonModeForState({ mode: "teleport" }), "teleport");
  assert.equal(ribbonModeForState({ mode: "craft" }), "craft");
  assert.equal(ribbonModeForState({ tool: "spawn" }), "spawn");
  assert.equal(ribbonModeForState({ tool: "use" }), "use");
  assert.equal(ribbonModeForState({ placing: "worldwonder" }), "wonder");
  assert.equal(ribbonModeForState({ mode: "admin" }), "admin");
});

test("ribbon helper flags separate scrolling content from advanced tools", () => {
  assert.equal(ribbonNeedsHorizontalScroll("build"), true);
  assert.equal(ribbonNeedsHorizontalScroll("teleport"), true);
  assert.equal(ribbonIsAdvanced("craft"), true);
  assert.equal(ribbonIsAdvanced("tools"), true);
});
