import assert from "node:assert/strict";
import test from "node:test";
import { objectPreviewDescription, objectPreviewPrimaryAction, objectPreviewTitle } from "./objectPreviewPanelModel.ts";

test("object preview titles common world objects", () => {
  assert.equal(objectPreviewTitle({ kind: "tree", x: 1, z: 2 }), "Tree");
  assert.equal(objectPreviewTitle({ kind: "food", x: 1, z: 2 }), "Crop patch");
  assert.equal(objectPreviewTitle({ kind: "npc", x: 1, z: 2, name: "Mira" }), "Mira");
});

test("object preview primary actions map to tool semantics", () => {
  assert.equal(objectPreviewPrimaryAction({ kind: "tree", x: 0, z: 0 }), "select-axe");
  assert.equal(objectPreviewPrimaryAction({ kind: "rock", x: 0, z: 0 }), "select-pickaxe");
  assert.equal(objectPreviewPrimaryAction({ kind: "food", x: 0, z: 0 }), "harvest-food");
});

test("crop description documents food as health recovery", () => {
  assert.match(objectPreviewDescription({ kind: "food", x: 0, z: 0 }), /health/i);
});
