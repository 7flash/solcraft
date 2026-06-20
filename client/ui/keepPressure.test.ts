import test from "node:test";
import assert from "node:assert/strict";
import { keepPressureModel } from "./keepPressure.ts";

test("keepPressureModel reports weak keep pressure and next regeneration", () => {
  const m = keepPressureModel({ hp: 40, maxHp: 100, stored: 100, accAt: 1000, now: 3500, playerHp: 80 });
  assert.equal(m.pressure, "weak");
  assert.equal(m.nextRegenLabel, "3s to next recovery");
  assert.ok(m.coinChip > 0);
  assert.equal(m.canRaid, true);
});

test("keepPressureModel warns when player is too hurt", () => {
  const m = keepPressureModel({ hp: 90, maxHp: 100, playerHp: 8 });
  assert.equal(m.canRaid, false);
  assert.equal(m.raidHealthLabel, "Recover health before raiding");
});

test("keepPressureModel treats full keeps as fully recovered", () => {
  const m = keepPressureModel({ hp: 100, maxHp: 100, accAt: 0, now: 999999, playerHp: 100 });
  assert.equal(m.nextRegenMs, 0);
  assert.equal(m.nextRegenLabel, "Fully recovered");
});
