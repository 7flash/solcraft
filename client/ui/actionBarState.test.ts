import test from "node:test";
import assert from "node:assert/strict";
import { actionBarActive, isBuildRibbonOpen, isMorePanelOpen } from "./actionBarState.ts";

test("detects build ribbon state", () => {
  assert.equal(isBuildRibbonOpen({ mode: "build" }), true);
  assert.equal(isBuildRibbonOpen({ mode: "place" }), true);
  assert.equal(isBuildRibbonOpen({ mode: "explore" }), false);
});

test("detects more panel state", () => {
  assert.equal(isMorePanelOpen({ panel: "more" }), true);
  assert.equal(isMorePanelOpen({ panel: "settings" }), false);
});

test("maps core action active states", () => {
  assert.equal(actionBarActive({ mode: "explore", tool: "none" })["explore-mode"], true);
  assert.equal(actionBarActive({ mode: "explore", tool: "wood" })["gather-wood"], true);
  assert.equal(actionBarActive({ mode: "build", tool: "build" })["select-build"], true);
  assert.equal(actionBarActive({ panel: "more" })["open-more"], true);
});
