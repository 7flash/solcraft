import test from "node:test";
import assert from "node:assert/strict";
import { equippedGearRows, playerModalViewModel } from "./playerModalModel.ts";

test("playerModalViewModel normalizes player stats for display", () => {
  const vm = playerModalViewModel({ target: { name: "Ada", level: 4, hp: 21.2, body: 0x14f195, x: 2, z: 3 }, worldPlayer: { x: 4, z: 5 } });
  assert.equal(vm.name, "Ada");
  assert.equal(vm.level, 4);
  assert.equal(vm.hpNow, 22);
  assert.equal(vm.bodyHex, "#14f195");
  assert.equal(vm.adjacent, true);
});

test("equippedGearRows returns stable empty rows", () => {
  const rows = equippedGearRows({ equip: { hand: "axe" } }, ["hand", "head"], { hand: "Hand", head: "Head" }, { axe: { glyph: "🪓", name: "Axe" } });
  assert.deepEqual(rows, [
    { slot: "hand", label: "Hand", text: "🪓 Axe", empty: false },
    { slot: "head", label: "Head", text: "—", empty: true },
  ]);
});
