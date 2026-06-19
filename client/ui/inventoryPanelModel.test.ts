import test from "node:test";
import assert from "node:assert/strict";
import { inventoryPackSlots, inventoryResourceRows } from "./inventoryPanelModel.ts";

test("inventoryResourceRows normalizes missing resource amounts", () => {
  const rows = inventoryResourceRows({ w: 3 }, ["w", "s"], { w: "Wood", s: "Stone" }, { w: "🪵", s: "🪨" });
  assert.deepEqual(rows, [
    { id: "w", name: "Wood", glyph: "🪵", amount: 3 },
    { id: "s", name: "Stone", glyph: "🪨", amount: 0 },
  ]);
});

test("inventoryPackSlots resolves item labels without UI dependencies", () => {
  const rows = inventoryPackSlots([
    { t: "bomb", id: "ram" },
    { t: "use", id: "elixir" },
    { t: "gear", id: "axe" },
    null,
  ], 4, {
    destroyById: { ram: { glyph: "⚒", name: "Ram", blurb: "Break walls" } },
    useItems: { elixir: { glyph: "🧪", name: "Elixir", blurb: "Restore" } },
    gearById: { axe: { glyph: "🪓", name: "Axe" } },
  });
  assert.equal(rows[0].label, "Ram");
  assert.equal(rows[1].glyph, "🧪");
  assert.equal(rows[2].click, "pack-equip");
  assert.equal(rows[3].empty, true);
});
