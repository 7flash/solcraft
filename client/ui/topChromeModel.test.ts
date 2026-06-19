import test from "node:test";
import assert from "node:assert/strict";
import { topChromeButtons } from "./topChromeModel.ts";

test("topChromeButtons keeps stable delegated click contract", () => {
  const buttons = topChromeButtons();
  assert.deepEqual(buttons.map((b) => b.click), [
    "open-world-map",
    "camera-zoom-out",
    "camera-zoom-in",
    "toggle-panel",
    "toggle-ui-sound",
    "forget-session",
  ]);
});

test("topChromeButtons marks settings and muted state", () => {
  const buttons = topChromeButtons({ settingsOpen: true, muted: true });
  const settings = buttons.find((b) => b.id === "settings");
  const sound = buttons.find((b) => b.id === "sound");
  assert.match(settings?.className || "", /\bon\b/);
  assert.match(sound?.className || "", /\bmuted\b/);
  assert.equal(sound?.ariaLabel, "Sound muted");
});
