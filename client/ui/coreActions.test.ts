import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ACTIONS } from "./coreActions.ts";

test("core action bar is a compact seven-slot loop", () => {
  assert.equal(CORE_ACTIONS.length, 7);
  assert.deepEqual(CORE_ACTIONS.map((a) => a.label), ["Move", "Chop", "Mine", "Claim", "Build", "Use", "More"]);
});

test("advanced/monetary systems are not primary HUD actions", () => {
  const labels = CORE_ACTIONS.map((a) => a.label.toLowerCase());
  assert.equal(labels.includes("bank"), false);
  assert.equal(labels.includes("siege"), false);
  assert.equal(labels.includes("wonder"), false);
});
