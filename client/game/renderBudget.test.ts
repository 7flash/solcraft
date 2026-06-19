import test from "node:test";
import assert from "node:assert/strict";
import { frameThrottleMsForMotion, shouldEnterPerfMode } from "./renderBudget.ts";

test("classic motion does not cap the renderer below 60fps", () => {
  assert.equal(frameThrottleMsForMotion("smooth"), 0);
  assert.equal(frameThrottleMsForMotion("classic"), 0);
  assert.equal(frameThrottleMsForMotion("low"), 33);
});

test("perf mode waits for enough slow-frame evidence", () => {
  assert.equal(shouldEnterPerfMode({ slowFrames: 100, totalFrames: 119 }), false);
  assert.equal(shouldEnterPerfMode({ slowFrames: 20, totalFrames: 150 }), false);
  assert.equal(shouldEnterPerfMode({ slowFrames: 45, totalFrames: 150 }), true);
});
