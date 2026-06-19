import test from "node:test";
import assert from "node:assert/strict";
import { miniPreviewKey, miniPreviewLabel } from "./miniPreviewModel.ts";

test("miniPreviewKey includes kind, building kind, and accent", () => {
  assert.equal(miniPreviewKey("building", "farm", "#14f195"), "building|farm|#14f195");
});

test("miniPreviewLabel names inspected entities", () => {
  assert.match(miniPreviewLabel("building", "keep"), /keep/);
  assert.match(miniPreviewLabel("tree"), /tree/i);
  assert.match(miniPreviewLabel("food"), /crop/i);
});
