import test from "node:test";
import assert from "node:assert/strict";
import { hexFromColorNumber, tileFromCanvasPoint, worldMapCanvasView } from "./mapCanvas.ts";

test("hexFromColorNumber normalizes numeric colors", () => {
  assert.equal(hexFromColorNumber(0x14f195), "#14f195");
  assert.equal(hexFromColorNumber("255"), "#0000ff");
  assert.equal(hexFromColorNumber("nope", "#abc123"), "#abc123");
});

test("worldMapCanvasView keeps a positive scale and centered origin", () => {
  const view = worldMapCanvasView({ minX: -10, maxX: 10, minZ: -5, maxZ: 5 }, 420, 300, false);
  assert.ok(view.scale >= 1);
  assert.equal(view.spanX, 21);
  assert.equal(view.spanZ, 11);
  assert.ok(Number.isFinite(view.ox));
  assert.ok(Number.isFinite(view.oz));
});

test("tileFromCanvasPoint maps pointer coordinates back to map tiles", () => {
  const view = worldMapCanvasView({ minX: 0, maxX: 9, minZ: 0, maxZ: 9 }, 100, 100, false);
  const x = view.ox + 4 * view.scale;
  const z = view.oz + 6 * view.scale;
  const tile = tileFromCanvasPoint(view, 100, 100, { left: 0, top: 0, width: 100, height: 100 }, x, z);
  assert.deepEqual(tile, { x: 4, z: 6 });
});
