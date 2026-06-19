import test from "node:test";
import assert from "node:assert/strict";
import { worldMapCounts, worldMapLegendItems, worldMapModeHelp, worldMapSummary } from "./worldMapModel.ts";

test("worldMapCounts safely counts optional map arrays", () => {
  assert.deepEqual(worldMapCounts(), { players: 0, tiles: 0, buildings: 0 });
  assert.deepEqual(worldMapCounts({ map: { players: [1, 2], tiles: [1], buildings: [1, 2, 3] } }), {
    players: 2,
    tiles: 1,
    buildings: 3,
  });
});

test("worldMapLegendItems keeps stable legend ordering", () => {
  assert.deepEqual(worldMapLegendItems().map((x) => x.id), ["you", "players", "wonders", "coins"]);
});

test("worldMapModeHelp distinguishes admin teleport from player walk mode", () => {
  assert.equal(worldMapModeHelp(true).label, "Admin:");
  assert.match(worldMapModeHelp(true).text, /teleport/);
  assert.equal(worldMapModeHelp(false).label, "Player:");
  assert.match(worldMapModeHelp(false).text, /walk/);
});

test("worldMapSummary formats the compact map metrics", () => {
  assert.equal(worldMapSummary({ map: { players: [1], tiles: [1, 2], buildings: [1, 2, 3] } }), "2 tiles · 3 buildings · 1 player markers");
});
