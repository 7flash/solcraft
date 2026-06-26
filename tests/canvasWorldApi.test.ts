import test from "node:test";
import assert from "node:assert/strict";
import { CANVAS_WORLD_REQUIRED_KEYS, missingCanvasWorldKeys } from "../client/world/canvasWorldApi";

test("CanvasWorldApi required key list is non-empty and stable", () => {
  assert.ok(CANVAS_WORLD_REQUIRED_KEYS.includes("pickFromEvent" as any));
  assert.ok(CANVAS_WORLD_REQUIRED_KEYS.includes("minimapSnapshot" as any));
  assert.ok(CANVAS_WORLD_REQUIRED_KEYS.includes("tryMoveDelta" as any));
});

test("missingCanvasWorldKeys reports missing shims", () => {
  const fake: any = {};
  const missing = missingCanvasWorldKeys(fake);
  assert.ok(missing.includes("applyWorld"));
  assert.ok(missing.includes("pickFromEvent"));
});

test("missingCanvasWorldKeys accepts a complete fake renderer", () => {
  const fake: any = {};
  for (const key of CANVAS_WORLD_REQUIRED_KEYS) fake[key] = key.endsWith("Pool") || key === "cells" || key === "tileOwner" ? new Map() : (() => null);
  fake.me = { x: 0, z: 0 };
  fake.hoverMarker = { visible: false, position: { x: 0, z: 0 } };
  assert.deepEqual(missingCanvasWorldKeys(fake), []);
});
