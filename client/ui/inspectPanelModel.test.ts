import test from "node:test";
import assert from "node:assert/strict";
import {
  cooldownSecondsLeft,
  draftHasColor,
  hexFromNumber,
  hpRatio,
  inspectAccent,
  inspectPanelViewModel,
  isMine,
  rgba,
  safeHex,
} from "./inspectPanelModel.ts";

test("safeHex normalizes valid hex and falls back for unsafe input", () => {
  assert.equal(safeHex("#AABBcc"), "#aabbcc");
  assert.equal(safeHex("red", "#112233"), "#112233");
});

test("hexFromNumber clamps to a CSS hex color", () => {
  assert.equal(hexFromNumber(0x14f195), "#14f195");
  assert.equal(hexFromNumber(0xffffff + 99), "#ffffff");
});

test("rgba converts a hex color into a CSS rgba string", () => {
  assert.equal(rgba("#010203", 0.5), "rgba(1,2,3,0.5)");
});

test("hpRatio is clamped and safe for missing max hp", () => {
  assert.equal(hpRatio(25, 100), 0.25);
  assert.equal(hpRatio(150, 100), 1);
  assert.equal(hpRatio(10, 0), 1);
});

test("cooldownSecondsLeft rounds up positive cooldown time", () => {
  assert.equal(cooldownSecondsLeft(10_001, 9_000), 2);
  assert.equal(cooldownSecondsLeft(8_000, 9_000), 0);
});

test("draft color overrides live building accent only for current inspect uid", () => {
  const building = { uid: "b1", cl: "#111111" };
  const def = { baseC: 0x222222 };
  assert.equal(draftHasColor({ uid: "b1", cl: "#333333" }, "b1"), true);
  assert.equal(inspectAccent(building, def, { uid: "b1", cl: "#333333" }, "b1"), "#333333");
  assert.equal(inspectAccent(building, def, { uid: "b2", cl: "#333333" }, "b1"), "#111111");
});

test("inspectPanelViewModel derives ownership, hp, cooldown, and color labels", () => {
  const vm = inspectPanelViewModel({
    building: { uid: "b1", owner: 7, ownerFace: "remote.png", level: 2, hp: 50, maxHp: 100, cdUntil: 12_000, cl: null },
    player: { id: 7 },
    def: { baseC: 0x14f195 },
    inspectUid: "b1",
    inspectDraft: { uid: "b1", cl: "#9945ff" },
    faceImage: "mine.png",
    now: 10_500,
  });
  assert.equal(vm.mine, true);
  assert.equal(vm.face, "mine.png");
  assert.equal(vm.hpPct, 0.5);
  assert.equal(vm.cdLeft, 2);
  assert.equal(vm.accent, "#9945ff");
  assert.equal(vm.accentLabel, "#9945ff");
});

test("isMine compares ids safely across number/string boundaries", () => {
  assert.equal(isMine({ owner: "42" }, { id: 42 }), true);
  assert.equal(isMine({ owner: 9 }, { id: 42 }), false);
});
