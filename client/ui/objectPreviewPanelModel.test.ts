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
  const p = { kind: "keep" as const, x: 20, z: 9, name: "North Keep", hp: 55, maxHp: 120, coins: 30 };
  const text = objectPreviewDescription(p);
  assert.match(text, /Coordinate in chat/i);
  assert.match(text, /55\/120 HP/);
  assert.match(text, /30 coins/);
});

test("build tile preview offers building choice instead of walking primary", () => {
  const p = { kind: "buildTile" as const, x: 7, z: 3, name: "Build site" };
  assert.equal(objectPreviewTitle(p), "Build site");
  assert.match(objectPreviewDescription(p), /Choose the building/i);
  assert.equal(objectPreviewPrimaryAction(p), "choose-building");
  assert.equal(objectPreviewActionLabel("choose-building"), "Choose building");
  assert.equal(objectPreviewShouldShowPrimary(p), true);
});


test("npc previews are friendly and actionable", () => {
  const p = { kind: "npc" as const, x: 8, z: 9, name: "Meadow Wanderer", title: "Wanderer", role: "wanderer", coins: 8, attack: 3 };
  assert.equal(objectPreviewTitle(p), "Meadow Wanderer");
  assert.match(objectPreviewDescription(p), /crossing the frontier/i);
  assert.doesNotMatch(objectPreviewDescription(p), /eventually|HUD menus/i);
  assert.equal(objectPreviewPrimaryAction(p), "attack-npc");
  assert.equal(objectPreviewActionLabel("attack-npc"), "Attack");
  assert.equal(objectPreviewActionLabel("donate-npc"), "Donate");
});
