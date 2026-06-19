import assert from "node:assert/strict";
import test from "node:test";
import { capRatio, limitAdviceRows, limitAdviceSummary, playerHudViewModel, playerInitial, splitGameplayHint } from "./playerHudModel.ts";

test("playerInitial returns an uppercase fallback-safe initial", () => {
  assert.equal(playerInitial("settler"), "S");
  assert.equal(playerInitial(""), "?");
});

test("capRatio clamps invalid and over-cap values", () => {
  assert.equal(capRatio(10, 0), 0);
  assert.equal(capRatio(5, 10), 0.5);
  assert.equal(capRatio(30, 10), 1);
});

test("limitAdviceRows warns near tile and resource caps", () => {
  const rows = limitAdviceRows({ territory: 22, tileCap: 24, inv: { w: 97, s: 10 }, storageCap: { w: 100, s: 100 } });
  assert.equal(rows[0].key, "tiles");
  assert.ok(rows.some((r) => r.key === "w"));
  assert.ok(limitAdviceSummary({ territory: 1, tileCap: 24, inv: {}, storageCap: {} }).includes("healthy"));
});

test("splitGameplayHint separates action lead from guidance body", () => {
  assert.deepEqual(splitGameplayHint("5 — place Cottage · green tile only"), { lead: "5", rest: "place Cottage · green tile only" });
  assert.equal(splitGameplayHint("Goal: claim land").lead, "Goal: claim land");
});

test("playerHudViewModel computes display-safe meter values", () => {
  const vm = playerHudViewModel({
    player: { name: "Ada", level: 3, hp: 82.2, maxE: 50, xp: 30, inv: { g: 8.9, sc: 2 }, territory: 4, tileCap: 20, built: 3 },
    liveEnergy: 25,
    maxHp: 100,
    xpNeeded: 60,
    visiblePlayers: 2,
    activePlayers: 5,
    gameplayHint: "2 — trees are highlighted",
  });
  assert.equal(vm.initial, "A");
  assert.equal(vm.gold, 8);
  assert.equal(vm.energyPct, 50);
  assert.equal(vm.hpNow, 83);
  assert.equal(vm.xpPct, 50);
  assert.equal(vm.hintLead, "2");
  assert.equal(vm.activePlayers, 5);
});
