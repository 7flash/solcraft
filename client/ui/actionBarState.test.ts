import test from "node:test";
import assert from "node:assert/strict";
import { actionBarActive, isAxeActive, isBuildRibbonOpen, isCaptureActive, isDemolishActive, isPickaxeActive } from "./actionBarState.ts";

test("detects the five toolbelt active states", () => {
  assert.equal(isAxeActive({ tool: "wood" }), true);
  assert.equal(isPickaxeActive({ tool: "stone" }), true);
  assert.equal(isBuildRibbonOpen({ mode: "build", tool: "build" }), true);
  assert.equal(isBuildRibbonOpen({ mode: "place", tool: "build" }), true);
  assert.equal(isDemolishActive({ mode: "demolish", tool: "demolish" }), true);
  assert.equal(isCaptureActive({ tool: "claim" }), true);
});

test("maps bottom toolbelt active states", () => {
  assert.equal(actionBarActive({ mode: "explore", tool: "wood" })["gather-wood"], true);
  assert.equal(actionBarActive({ mode: "explore", tool: "stone" })["gather-stone"], true);
  assert.equal(actionBarActive({ mode: "build", tool: "build" })["select-build"], true);
  assert.equal(actionBarActive({ mode: "demolish", tool: "demolish" })["demolish-tool"], true);
  assert.equal(actionBarActive({ mode: "explore", tool: "claim" })["capture-tool"], true);
});

test("capture is selected cursor state, not a nested ribbon/menu", () => {
  const active = actionBarActive({ mode: "explore", tool: "claim" });
  assert.equal(active["capture-tool"], true);
  assert.equal(active["select-build"], false);
  assert.equal(active["teleport-toggle"], false);
});
