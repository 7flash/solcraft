import test from "node:test";
import assert from "node:assert/strict";
import { activeCameraButtonClass, activeScaleButtonClass, moreTileClass, scaleControlKey, scaleResetLabel, soundStatus } from "./utilityPanelModel.ts";

test("moreTileClass marks only the active panel tile", () => {
  assert.equal(moreTileClass({ panel: "settings" }, "settings"), "more-tile on");
  assert.equal(moreTileClass({ panel: "settings" }, "quests"), "more-tile");
  assert.equal(moreTileClass({ click: "toggle-ui-sound" }, "settings"), "more-tile");
});

test("soundStatus summarizes both audio toggles", () => {
  assert.equal(soundStatus(true, true), "Muted");
  assert.equal(soundStatus(false, true), "On");
  assert.equal(soundStatus(true, false), "On");
});

test("scale helpers preserve settings contracts", () => {
  assert.equal(scaleControlKey("menu"), "menuScale");
  assert.equal(scaleControlKey("ui"), "uiScale");
  assert.equal(scaleResetLabel("menu"), "menu");
  assert.equal(scaleResetLabel("ui"), "interface");
  assert.equal(activeScaleButtonClass(1, 1), "btn primary");
  assert.equal(activeScaleButtonClass(1, 1.25), "btn");
});

test("camera preset class uses a small tolerance", () => {
  assert.equal(activeCameraButtonClass(1.01, 1), "btn primary");
  assert.equal(activeCameraButtonClass(1.05, 1), "btn");
});
