import assert from "node:assert/strict";
import test from "node:test";
import { RollingMetric, formatMs, fpsFromDeltaMs, isLikelyUiStall, perfOverlayEnabledFromUrl } from "./perfOverlay.ts";

test("RollingMetric keeps a bounded rolling window", () => {
  const m = new RollingMetric(3);
  m.push(1); m.push(2); m.push(3); m.push(4);
  assert.equal(m.count, 3);
  assert.equal(m.last, 4);
  assert.equal(m.avg(), 3);
  assert.equal(m.percentile(0.95), 4);
});

test("formatMs and fps helpers are readable", () => {
  assert.equal(formatMs(6.234), "6.23ms");
  assert.equal(formatMs(16.25), "16.3ms");
  assert.equal(Math.round(fpsFromDeltaMs(16.666)), 60);
});

test("perf overlay can be enabled from query string", () => {
  assert.equal(perfOverlayEnabledFromUrl("?perf=1", null), true);
  assert.equal(perfOverlayEnabledFromUrl("?x=1&perf=off", null), false);
});

test("UI stall heuristic separates UI from WebGL stalls", () => {
  assert.equal(isLikelyUiStall({ uiMs: 11, renderMs: 3, frameMs: 24 }), true);
  assert.equal(isLikelyUiStall({ uiMs: 2, renderMs: 15, frameMs: 24 }), false);
});
