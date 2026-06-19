import assert from "node:assert/strict";
import test from "node:test";
import { toolCursorForState } from "./toolCursor.ts";

test("selected tools override hover intent", () => {
  assert.equal(toolCursorForState({ screen: "playing", tool: "wood", hover: "building" }), "axe");
  assert.equal(toolCursorForState({ screen: "playing", tool: "stone", hover: "walk" }), "pickaxe");
  assert.equal(toolCursorForState({ screen: "playing", mode: "place", hover: "walk" }), "hammer");
});

test("neutral play cursor is walk, not system default", () => {
  assert.equal(toolCursorForState({ screen: "playing", tool: "none" }), "walk");
  assert.equal(toolCursorForState({ screen: "playing", tool: "none", hover: "tile" }), "walk");
});

test("hovering objects without a tool changes cursor intent", () => {
  assert.equal(toolCursorForState({ screen: "playing", tool: "none", hover: "building" }), "inspect");
  assert.equal(toolCursorForState({ screen: "playing", tool: "none", hover: "tree" }), "inspect");
  assert.equal(toolCursorForState({ screen: "playing", tool: "none", hover: "npc" }), "interact");
});

test("non-playing screens use default", () => {
  assert.equal(toolCursorForState({ screen: "menu", tool: "wood" }), "default");
});
