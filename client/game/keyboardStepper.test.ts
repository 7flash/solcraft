import test from "node:test";
import assert from "node:assert/strict";
import { canIssueKeyboardStep, nextKeyboardStepAt, DEFAULT_KEYBOARD_STEP_MS } from "./keyboardStepper.ts";

test("keyboard stepper allows first movement immediately", () => {
  assert.equal(canIssueKeyboardStep({ nowMs: 10, lastStepMs: 0 }), true);
});

test("keyboard stepper blocks repeat bursts inside cadence window", () => {
  assert.equal(canIssueKeyboardStep({ nowMs: 100, lastStepMs: 1, minStepMs: 158 }), false);
  assert.equal(canIssueKeyboardStep({ nowMs: 159, lastStepMs: 1, minStepMs: 158 }), true);
});

test("keyboard stepper exposes next due time", () => {
  assert.equal(nextKeyboardStepAt(1000), 1000 + DEFAULT_KEYBOARD_STEP_MS);
});
