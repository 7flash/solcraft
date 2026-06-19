import test from "node:test";
import assert from "node:assert/strict";
import { buildChoiceState, craftedToolOwnedCount, missingCostKeys, usablePackItems } from "./actionRibbonModel.ts";

test("missingCostKeys compares inventory and live energy", () => {
  assert.deepEqual(missingCostKeys({ w: 3, s: 2, e: 4 }, { inv: { w: 4, s: 1 } }, 5), ["s"]);
  assert.deepEqual(missingCostKeys({ e: 4 }, { inv: {} }, 2), ["e"]);
});

test("buildChoiceState reports lock, missing cost, active, and wonder gold", () => {
  assert.deepEqual(buildChoiceState({ id: "farm", unlock: 3, cost: { w: 2 } }, { territory: 1, inv: { w: 10 } }, 0, "farm", 0), {
    id: "farm",
    active: true,
    locked: true,
    missing: [],
    needsWonderGold: false,
    disabled: true,
  });
  const wonder = buildChoiceState({ id: "worldwonder", unlock: 0, cost: {} }, { territory: 10, inv: { g: 5 } }, 0, null, 20);
  assert.equal(wonder.needsWonderGold, true);
  assert.equal(wonder.disabled, true);
});

test("usablePackItems and craftedToolOwnedCount summarize pack state", () => {
  const pack = [{ t: "use", id: "tea" }, null, { t: "bomb", id: "spark" }, { t: "use", id: "scroll" }, { t: "bomb", id: "spark" }];
  assert.deepEqual(usablePackItems({ pack }).map((x) => [x.index, x.item.id]), [[0, "tea"], [3, "scroll"]]);
  assert.equal(craftedToolOwnedCount(pack, "spark"), 2);
});
