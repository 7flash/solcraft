import test from "node:test";
import assert from "node:assert/strict";
import { isMoveKey, movementVectorFromKeys, normalizeMoveKey, rotateKeyboardVector } from "../directionalInput.ts";

test("movementVectorFromKeys supports diagonal WASD movement", () => {
  assert.deepEqual(movementVectorFromKeys(new Set(["up", "left"])), { x: -1, z: -1 });
  assert.deepEqual(movementVectorFromKeys(new Set(["down", "right"])), { x: 1, z: 1 });
});

test("opposite held keys cancel cleanly", () => {
  assert.deepEqual(movementVectorFromKeys(new Set(["up", "down", "left"])), { x: -1, z: 0 });
  assert.deepEqual(movementVectorFromKeys(new Set(["left", "right"])), { x: 0, z: 0 });
});

test("normalizes arrow keys and WASD", () => {
  assert.equal(normalizeMoveKey("ArrowUp"), "up");
  assert.equal(normalizeMoveKey("a"), "left");
  assert.equal(isMoveKey("Enter"), false);
});

test("rotateKeyboardVector preserves one-tile Chebyshev output", () => {
  assert.deepEqual(rotateKeyboardVector(-1, -1, Math.PI / 4), { x: -1, z: -1 });
  assert.deepEqual(rotateKeyboardVector(-1, 0, Math.PI / 4 + Math.PI / 2), { x: 0, z: -1 });
});
