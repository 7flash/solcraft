import assert from "node:assert/strict";
import test from "node:test";
import { tileCapacityForProgress, tileCapacityExplanation } from "./progressionRules.ts";

test("tile capacity grows primarily from player level", () => {
  assert.equal(tileCapacityForProgress({ level: 1, buildings: [] }), 18);
  assert.equal(tileCapacityForProgress({ level: 3, buildings: [] }), 30);
});

test("completed houses add small local capacity without becoming the whole progression", () => {
  assert.equal(tileCapacityForProgress({ level: 2, buildings: [{ kind: "cottage", level: 1 }] }), 26);
  assert.equal(tileCapacityForProgress({ level: 2, buildings: [{ kind: "cottage", level: 2 }] }), 28);
});

test("under-construction buildings do not increase tile capacity yet", () => {
  assert.equal(tileCapacityForProgress({ level: 2, buildings: [{ kind: "cottage", level: 1, constructUntil: Date.now() + 10_000 }] }), 24);
});

test("explanation is player-facing", () => {
  assert.match(tileCapacityExplanation({ level: 4, buildings: [] }), /Level 4 supports/);
  assert.doesNotMatch(tileCapacityExplanation({ level: 4, buildings: [] }), /alt|abuse|grind/i);
});
