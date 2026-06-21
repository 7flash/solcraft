import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorldSyncSnapshot } from "./worldSyncCompat.ts";

test("accepts current solcraft world export", () => {
  const result = normalizeWorldSyncSnapshot({
    kind: "solcraft-world-export",
    scope: "world",
    generatedAt: 100,
    tables: { players: [{ id: 1, name: "Ada", x: 3, z: -2 }], tiles: [], buildings: [] },
  });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.players.length, 1);
  assert.equal(result.snapshot.counts.players, 1);
  assert.ok(result.snapshot.tables.meta);
});

test("rejects summary-only production responses", () => {
  const result = normalizeWorldSyncSnapshot({ scope: "world", generatedAt: 100, players: [] }, { source: "remote" });
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "SUMMARY_ONLY_EXPORT");
});

test("drops unsupported tables and fills missing tables", () => {
  const result = normalizeWorldSyncSnapshot({
    kind: "old-export",
    scope: "world",
    tables: { players: [], hacked: [{ id: 1 }] },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.report.droppedTables, ["hacked"]);
  assert.ok(result.snapshot.tables.tiles);
  assert.ok(result.report.warnings.length >= 2);
});

test("unwraps nested snapshot payloads", () => {
  const result = normalizeWorldSyncSnapshot({ snapshot: { kind: "solcraft-world-export", tables: { players: [{ id: 7 }] } } });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.players[0].id, 7);
});
