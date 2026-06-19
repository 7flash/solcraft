import assert from "node:assert/strict";
import test from "node:test";
import { formatWorldSyncCounts, normalizeProductionOrigin } from "./worldSyncUrl.ts";

test("normalizes production origins safely", () => {
  assert.deepEqual(normalizeProductionOrigin("https://example.com///"), { ok: true, origin: "https://example.com", msg: "" });
  assert.deepEqual(normalizeProductionOrigin("example.com/path?q=1"), { ok: true, origin: "https://example.com", msg: "" });
  assert.equal(normalizeProductionOrigin("").ok, false);
  assert.equal(normalizeProductionOrigin("ftp://example.com").ok, false);
});

test("formats world sync counts", () => {
  assert.equal(formatWorldSyncCounts({ players: 2, tiles: 1234, buildings: 9 }), "2 players · 1,234 tiles · 9 buildings");
});
