import { describe, expect, test } from "bun:test";
import { runParityCase } from "./parityHarness.ts";

type TinyState = { x: number; log: string[] };
const action = { type: "move", x: 1, z: 0 };
const project = (s: TinyState) => ({ x: s.x, log: s.log });

describe("ecs parity harness", () => {
  test("passes when legacy and ecs outputs/projections match", () => {
    const runner = (s: TinyState) => { s.x += 1; s.log.push("moved"); return { ok: true, x: s.x }; };
    const result = runParityCase({ name: "matching", state: { x: 0, log: [] }, playerId: 1, action, project }, runner, runner);
    expect(result.ok).toBe(true);
  });

  test("fails when projected state diverges", () => {
    const legacy = (s: TinyState) => { s.x += 1; return { ok: true }; };
    const ecs = (s: TinyState) => { s.x += 2; return { ok: true }; };
    const result = runParityCase({ name: "divergent", state: { x: 0, log: [] }, playerId: 1, action, project }, legacy, ecs);
    expect(result.ok).toBe(false);
  });
});
