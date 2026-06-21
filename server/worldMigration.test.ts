import test from "node:test";
import assert from "node:assert/strict";
import { applyCapitalMigration, keepCrossAnchors, planCapitalMigration, spiralPoint } from "./worldMigration.ts";

test("spiral places first players outside capital center", () => {
  assert.deepEqual(spiralPoint(0, 32, 22), [32, 0]);
  const p = spiralPoint(3, 32, 22);
  assert.ok(Math.abs(p[0]) >= 32 || Math.abs(p[1]) >= 32);
});

test("keep anchors form a cross around capital", () => {
  const rows = keepCrossAnchors({ keepsPerArm: 2, keepFirstDistance: 50, keepSpacing: 25 });
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], { index: 0, x: 50, z: 0, arm: "east" });
  assert.deepEqual(rows[2], { index: 2, x: -50, z: 0, arm: "west" });
});

test("plan reports unsupported building kinds", () => {
  const snap:any = { kind: "solcraft-world-export", tables: { players: [{ id: 1, name: "A", x: 100, z: 100 }], tiles: [{ id: 1, owner: 1, x: 100, z: 100 }], buildings: [{ id: 1, owner: 1, x: 100, z: 100, kind: "academy" }] } };
  const plan = planCapitalMigration(snap);
  assert.equal(plan.report.players, 1);
  assert.equal(plan.report.unsupportedKinds.academy, 1);
});

test("apply moves settlements and creates cross keeps", () => {
  const snap:any = { kind: "solcraft-world-export", tables: { players: [{ id: 1, name: "A", x: 100, z: 100 }], tiles: [{ id: 1, owner: 1, x: 100, z: 100 }], buildings: [{ id: 1, owner: 1, x: 101, z: 100, kind: "cottage" }] } };
  const plan = planCapitalMigration(snap, { keepsPerArm: 1 });
  const next:any = applyCapitalMigration(snap, plan);
  assert.equal(next.tables.players[0].x, plan.playerAnchors[0].to[0]);
  assert.equal(next.tables.buildings.some((b:any) => b.kind === "house"), true);
  assert.equal(next.tables.buildings.filter((b:any) => b.kind === "keep" && !b.owner).length, 4);
});
