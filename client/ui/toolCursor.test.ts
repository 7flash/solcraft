import test from "node:test";
import assert from "node:assert/strict";
import { toolCursorForState } from "./toolCursor.ts";

test("sword tool maps to sword cursor", () => {
  assert.equal(toolCursorForState({ screen: "playing", tool: "sword" }), "sword");
});

test("neutral hover maps to inspect or walk", () => {
  assert.equal(toolCursorForState({ screen: "playing", tool: "none", hover: "building" }), "inspect");
  assert.equal(toolCursorForState({ screen: "playing", tool: "none" }), "walk");
});
