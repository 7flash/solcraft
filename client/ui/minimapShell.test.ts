import test from "node:test";
import assert from "node:assert/strict";
import { MINIMAP_CLASS, MINIMAP_ID, MINIMAP_SIZE, MINIMAP_TITLE } from "./minimapShell.ts";

test("minimap shell contract stays stable for canvas renderer", () => {
  assert.equal(MINIMAP_ID, "sc-minimap");
  assert.match(MINIMAP_CLASS, /\bminimap\b/);
  assert.equal(MINIMAP_SIZE, 190);
  assert.equal(MINIMAP_TITLE, "Open world map");
});
