import test from "node:test";
import assert from "node:assert/strict";
import { objectPreviewDescription, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewTitle } from "./objectPreviewPanelModel.ts";

test("tree preview explains toolbelt instead of selecting axe from the panel", () => {
  const p = { kind: "tree" as const, x: 1, z: 2 };
  assert.equal(objectPreviewPrimaryAction(p), "walk-near");
  assert.equal(objectPreviewShouldShowPrimary(p), false);
  assert.match(objectPreviewDescription(p), /bottom toolbelt/i);
});

test("food and trade still expose direct interaction actions", () => {
  assert.equal(objectPreviewPrimaryAction({ kind: "food", x: 0, z: 0 }), "harvest-food");
  assert.equal(objectPreviewPrimaryAction({ kind: "trade", x: 0, z: 0 }), "open-trade");
  assert.equal(objectPreviewShouldShowPrimary({ kind: "trade", x: 0, z: 0 }), true);
});

test("titles remain stable", () => {
  assert.equal(objectPreviewTitle({ kind: "rock", x: 0, z: 0 }), "Rock");
  assert.equal(objectPreviewTitle({ kind: "npc", x: 0, z: 0, name: "Mira" }), "Mira");
});
