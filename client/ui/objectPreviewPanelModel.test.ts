import test from "node:test";
import assert from "node:assert/strict";
import { objectPreviewActionLabel, objectPreviewDescription, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewTitle } from "./objectPreviewPanelModel.ts";

test("shared chat locations open as walkable preview cards", () => {
  const p = { kind: "shared" as const, x: 4, z: -2, name: "Meet here" };
  assert.equal(objectPreviewTitle(p), "Meet here");
  assert.match(objectPreviewDescription(p), /shared in chat/i);
  assert.equal(objectPreviewPrimaryAction(p), "walk-near");
  assert.equal(objectPreviewActionLabel("walk-near"), "Walk near");
  assert.equal(objectPreviewShouldShowPrimary(p), true);
});

test("keep chat cards explain coordination loop", () => {
  const p = { kind: "keep" as const, x: 20, z: 9, name: "North Keep" };
  assert.match(objectPreviewDescription(p), /Coordinate in chat/i);
});
