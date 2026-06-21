import test from "node:test";
import assert from "node:assert/strict";
import { actionBarActive } from "./actionBarState.ts";

test("sword action is active when sword tool is selected", () => {
  assert.equal(actionBarActive({ tool: "sword" })["siege-tool"], true);
});
