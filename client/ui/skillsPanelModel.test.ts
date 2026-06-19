import test from "node:test";
import assert from "node:assert/strict";
import { skillsPanelRows } from "./skillsPanelModel.ts";

test("skillsPanelRows derives skill progress percentages", () => {
  const rows = skillsPanelRows(
    { skills: { gather: 1 }, skillXp: { gather: 30 } },
    [{ id: "gather", glyph: "🪓", name: "Gathering", blurb: "Harvest faster", max: 5 }],
    (skills, id) => skills[id] || 0,
  );
  assert.equal(rows[0].level, 1);
  assert.equal(rows[0].xpNeeded, 50);
  assert.equal(rows[0].xp, 30);
  assert.equal(rows[0].pct, 60);
});

test("skillsPanelRows clamps overflow xp to the current level requirement", () => {
  const rows = skillsPanelRows(
    { skills: { build: 0 }, skillXp: { build: 999 } },
    [{ id: "build", glyph: "🏗", name: "Build", blurb: "", max: 3 }],
    (skills, id) => skills[id] || 0,
  );
  assert.equal(rows[0].xp, 25);
  assert.equal(rows[0].pct, 100);
});
