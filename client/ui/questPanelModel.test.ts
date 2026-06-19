import test from "node:test";
import assert from "node:assert/strict";
import { guideSummaryForRows, guideTabCount, normalizeGuideRows, visibleGuideRows } from "./questPanelModel.ts";

test("normalizeGuideRows supplies stable defaults", () => {
  const rows = normalizeGuideRows([{ id: "chop", title: "Chop", done: true }]);
  assert.equal(rows[0].category, "actions");
  assert.equal(rows[0].glyph, "◇");
  assert.equal(rows[0].rewardText, "Guide reward");
  assert.equal(rows[0].done, true);
});

test("visibleGuideRows filters by category and done tab", () => {
  const rows = normalizeGuideRows([
    { id: "a", category: "actions", done: true },
    { id: "b", category: "buildings", done: false },
  ]);
  assert.deepEqual(visibleGuideRows(rows, "actions").map((r) => r.id), ["a"]);
  assert.deepEqual(visibleGuideRows(rows, "done").map((r) => r.id), ["a"]);
  assert.equal(guideTabCount(rows, "buildings"), 1);
});

test("guideSummaryForRows counts claimable rewards", () => {
  const rows = normalizeGuideRows([
    { id: "a", done: true, claimed: false },
    { id: "b", done: true, claimed: true },
    { id: "c", done: false, claimed: false },
  ]);
  const summary = guideSummaryForRows(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.done, 2);
  assert.equal(summary.claimed, 1);
  assert.equal(summary.claimable, 1);
  assert.equal(summary.pct, 67);
});
