import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProductionOrigin, summarizeWorldSyncFailure } from "./worldSyncImport.ts";

test("normalizes production origin", () => {
  assert.equal(normalizeProductionOrigin("https://example.com/admin/world-sync?x=1"), "https://example.com");
});

test("rejects invalid production origin", () => {
  assert.throws(() => normalizeProductionOrigin("example.com"), /full URL/);
});

test("explains summary-only export", () => {
  const msg = summarizeWorldSyncFailure({ data: { reasonCode: "SUMMARY_ONLY_EXPORT", msg: "Production returned a summary-only response." } });
  assert.match(msg, /older world-sync route/);
});
