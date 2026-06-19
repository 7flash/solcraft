import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOP_SECONDS, hopDurationForProjectedDistance, movementFeelBucket } from "./movementFeel.ts";

test("hop duration keeps normal projected steps at the base feel", () => {
  assert.equal(hopDurationForProjectedDistance({ projectedDistance: 100, referenceDistance: 100 }), DEFAULT_HOP_SECONDS);
});

test("hop duration lengthens long screen-projected steps instead of letting them look faster", () => {
  const dur = hopDurationForProjectedDistance({ projectedDistance: 170, referenceDistance: 100, baseSeconds: 0.16 });
  assert.equal(Number(dur.toFixed(3)), 0.272);
});

test("hop duration is capped so bad measurements cannot freeze movement", () => {
  const dur = hopDurationForProjectedDistance({ projectedDistance: 1000, referenceDistance: 100, baseSeconds: 0.16, maxScale: 1.75 });
  assert.equal(Number(dur.toFixed(3)), 0.28);
});

test("movement feel bucket marks long screen steps", () => {
  assert.equal(movementFeelBucket(100, 100), "normal");
  assert.equal(movementFeelBucket(140, 100), "long-screen-step");
  assert.equal(movementFeelBucket(0, 100), "invalid");
});
