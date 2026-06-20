import test from "node:test";
import assert from "node:assert/strict";
import { applyKeepRegen, keepCoinChip, keepRaidHitPreview, keepRaidNote } from "./keepRaid.ts";

test("neutral keeps regenerate in elapsed ticks", () => {
  const keep: any = { owner: 0, kind: "keep", hp: 50, maxHp: 100, accAt: 1000 };
  const out = applyKeepRegen(keep, 11000);
  assert.equal(out.ticks, 2);
  assert.equal(out.recovered, 14);
  assert.equal(keep.hp, 64);
});

test("keep regen does not exceed max hp", () => {
  const keep: any = { owner: 0, kind: "keep", hp: 98, maxHp: 100, accAt: 0 };
  const out = applyKeepRegen(keep, 50000);
  assert.equal(out.recovered, 2);
  assert.equal(keep.hp, 100);
});

test("raid hit requires enough health and computes deterministic backlash", () => {
  assert.equal(keepRaidHitPreview({ playerHp: 8 }).ok, false);
  const out: any = keepRaidHitPreview({ playerHp: 50, stored: 100, siegeBonus: 3, random: () => 0 });
  assert.equal(out.ok, true);
  assert.equal(out.damage, 15);
  assert.equal(out.backlash, 7);
  assert.equal(out.playerHpAfter, 43);
  assert.equal(out.coins, 3);
});

test("coin chips are bounded by stored keep coins", () => {
  assert.equal(keepCoinChip(2, 1000), 2);
  assert.equal(keepCoinChip(0, 1000), 0);
});

test("raid notes are player-facing and concise", () => {
  const note = keepRaidNote({ regenRecovered: 7, baseNote: "Keep took 12 damage.", backlash: 8, coins: 2 });
  assert.match(note, /recovered 7 HP/);
  assert.match(note, /struck back for 8 health/);
  assert.match(note, /\+2 coins/);
});
