import test from "node:test";
import assert from "node:assert/strict";
import { toolCursorForState } from "./toolCursor.ts";

test("maps bottom toolbelt selections to cursor names", () => {
  assert.equal(toolCursorForState({ screen: "playing", tool: "wood" }), "axe");
  assert.equal(toolCursorForState({ screen: "playing", tool: "stone" }), "pickaxe");
  assert.equal(toolCursorForState({ screen: "playing", tool: "claim" }), "capture");
  assert.equal(toolCursorForState({ screen: "playing", mode: "demolish", tool: "demolish" }), "shovel");
  assert.equal(toolCursorForState({ screen: "playing", mode: "build", tool: "build" }), "hammer");
});

test("keeps menus and neutral gameplay on default cursor", () => {
  assert.equal(toolCursorForState({ screen: "menu", tool: "wood" }), "default");
  assert.equal(toolCursorForState({ screen: "playing", mode: "explore", tool: "none" }), "default");
});

test("placing any building keeps hammer cursor even when mode data is partial", () => {
  assert.equal(toolCursorForState({ screen: "playing", placing: "farm" }), "hammer");
});
