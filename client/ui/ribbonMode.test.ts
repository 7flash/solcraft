import test from "node:test";
import assert from "node:assert/strict";
import { ribbonModeForState } from "./ribbonMode.ts";

test("hammer build tool does not open a top ribbon by itself", () => {
  assert.equal(ribbonModeForState({ mode: "build", tool: "build", placing: null }), null);
});

test("explicit world wonder placement still opens wonder ribbon", () => {
  assert.equal(ribbonModeForState({ mode: "wonder", tool: "wonder" }), "wonder");
});
