import test from "node:test";
import assert from "node:assert/strict";
import { miniPreviewKey, miniPreviewLabel, normalizePreviewAccent } from "./miniPreviewModel.ts";

test("miniPreviewKey includes kind, building kind, and accent", () => {
  assert.equal(miniPreviewKey("building", "farm", "#14f195"), "building|farm|#14f195");
});

test("miniPreviewLabel names inspected entities", () => {
  assert.match(miniPreviewLabel("building", "keep"), /keep/);
  assert.match(miniPreviewLabel("tree"), /tree/i);
  assert.match(miniPreviewLabel("food"), /crop/i);
});


test("miniPreviewKey normalizes accent values so previews are not recreated every paint", () => {
  assert.equal(normalizePreviewAccent(0x14f195), "#14f195");
  assert.equal(normalizePreviewAccent("14F195"), "#14f195");
  assert.equal(miniPreviewKey("building", "lumber", 0x14f195), miniPreviewKey("building", "lumber", "#14f195"));
});
