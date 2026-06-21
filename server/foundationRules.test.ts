import test from "node:test";
import assert from "node:assert/strict";
import { FOUNDATION_KIND, FOUNDATION_BUILD_KINDS, foundationChoiceLabel, isFoundationBuildKind } from "./foundationRules.ts";

test("foundation kind is separate from final building choices", () => {
  assert.equal(FOUNDATION_KIND, "foundation");
  assert.deepEqual([...FOUNDATION_BUILD_KINDS], ["cottage", "lumber", "quarry", "farm", "market"]);
});

test("validates foundation final building choices", () => {
  assert.equal(isFoundationBuildKind("farm"), true);
  assert.equal(isFoundationBuildKind("foundation"), false);
  assert.equal(isFoundationBuildKind("worldwonder"), false);
  assert.equal(isFoundationBuildKind("vault"), false);
});

test("uses player-facing names for basic choices", () => {
  assert.equal(foundationChoiceLabel("cottage"), "House");
  assert.equal(foundationChoiceLabel("quarry"), "Mine");
});
