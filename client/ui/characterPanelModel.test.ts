import test from "node:test";
import assert from "node:assert/strict";
import { characterPanelViewModel, characterPartRows, clampCharacterPartValue, isCharacterPresetActive, normalizeCharacterHex } from "./characterPanelModel.ts";

test("clampCharacterPartValue constrains part indexes to the doll atlas range", () => {
  assert.equal(clampCharacterPartValue(-4), 0);
  assert.equal(clampCharacterPartValue(3.9), 3);
  assert.equal(clampCharacterPartValue(99), 7);
  assert.equal(clampCharacterPartValue("bad"), 0);
});

test("characterPartRows returns stable rows with dynamic back hint", () => {
  const rows = characterPartRows({ parts: { head: 2, torso: 4, back: 0, legs: 8 } });
  assert.deepEqual(rows.map((row) => row.key), ["head", "torso", "back", "legs"]);
  assert.equal(rows[0].value, 2);
  assert.equal(rows[2].hint, "none");
  assert.equal(rows[3].value, 7);

  const withBack = characterPartRows({ parts: { back: 3 } });
  assert.equal(withBack[2].hint, "item");
});

test("normalizeCharacterHex accepts only complete six digit hex colors", () => {
  assert.equal(normalizeCharacterHex("#ABCDEF"), "#abcdef");
  assert.equal(normalizeCharacterHex("red", "#111111"), "#111111");
  assert.equal(normalizeCharacterHex("#fff", "#111111"), "#111111");
});

test("isCharacterPresetActive compares the persisted palette against a preset", () => {
  const preset = {
    skin: "#f0b887",
    hair: "#f4f0dd",
    primaryCloth: "#31507d",
    secondaryCloth: "#14f195",
    leather: "#6a4124",
    metal: "#b8c2cc",
  };
  assert.equal(isCharacterPresetActive({ palette: { ...preset } }, preset), true);
  assert.equal(isCharacterPresetActive({ palette: { ...preset, metal: "#000000" } }, preset), false);
});

test("characterPanelViewModel marks active preset cards", () => {
  const presets = [
    { id: "a", name: "A", skin: "#111111", hair: "#222222", primaryCloth: "#333333", secondaryCloth: "#444444", leather: "#555555", metal: "#666666" },
    { id: "b", name: "B", skin: "#aaaaaa", hair: "#bbbbbb", primaryCloth: "#cccccc", secondaryCloth: "#dddddd", leather: "#eeeeee", metal: "#ffffff" },
  ];
  const vm = characterPanelViewModel({ profile: { palette: { ...presets[1] } }, presets });
  assert.equal(vm.presetCards.length, 2);
  assert.equal(vm.presetCards[0].active, false);
  assert.equal(vm.presetCards[1].active, true);
});
