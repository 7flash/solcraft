import test from "node:test";
import assert from "node:assert/strict";
import { CAPITAL_BUILDINGS, capitalBuildingsInView, capitalLabelVisibleForPlayer, isCapitalVirtualBuilding } from "./capitalLayout.ts";

test("capital has core service buildings", () => {
  assert.ok(CAPITAL_BUILDINGS.some((b) => b.nm === "Capital Town Hall"));
  assert.ok(CAPITAL_BUILDINGS.some((b) => b.nm === "Capital Bank"));
  assert.ok(CAPITAL_BUILDINGS.some((b) => b.nm === "Mirror Tailor"));
  assert.ok(CAPITAL_BUILDINGS.some((b) => b.nm === "Guide Hall"));
});

test("capital buildings are virtual negative ids", () => {
  assert.equal(CAPITAL_BUILDINGS.every((b) => isCapitalVirtualBuilding(b.uid)), true);
});

test("capital only appears near origin", () => {
  assert.ok(capitalBuildingsInView(0, 0, 12).length >= 5);
  assert.equal(capitalBuildingsInView(200, 200, 12).length, 0);
});


test("capital labels are contextual", () => {
  const townHall = CAPITAL_BUILDINGS.find((b) => b.nm === "Capital Town Hall")!;
  const eastGate = CAPITAL_BUILDINGS.find((b) => b.nm === "East Gate")!;
  assert.equal(capitalLabelVisibleForPlayer(townHall, 1, 1), true);
  assert.equal(capitalLabelVisibleForPlayer(townHall, 20, 20), false);
  assert.equal(capitalLabelVisibleForPlayer(eastGate, 4, 0), false);
});
