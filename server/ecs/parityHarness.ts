import type { EcsAction } from "./dispatch.ts";
import type { Result } from "./result.ts";

export type LegacyActionRunner<State> = (state: State, playerId: number, action: EcsAction) => Result | Record<string, any>;
export type EcsActionRunner<State> = (state: State, playerId: number, action: EcsAction) => Result | Record<string, any>;

export type ParityProjection<State> = (state: State) => unknown;

export type ParityCase<State> = {
  name: string;
  state: State;
  playerId: number;
  action: EcsAction;
  project: ParityProjection<State>;
};

export type ParityResult = {
  name: string;
  ok: boolean;
  legacyResult: unknown;
  ecsResult: unknown;
  legacyState: unknown;
  ecsState: unknown;
  reason?: string;
};

function cloneState<T>(value: T): T {
  const sc = (globalThis as any).structuredClone;
  if (typeof sc === "function") {
    try { return sc(value); } catch {}
  }
  return JSON.parse(JSON.stringify(value));
}

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, any> = {};
  for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
  return out;
}

function stable(value: unknown) {
  return JSON.stringify(canonical(value));
}

export function runParityCase<State>(testCase: ParityCase<State>, legacy: LegacyActionRunner<State>, ecs: EcsActionRunner<State>): ParityResult {
  const legacyState = cloneState(testCase.state);
  const ecsState = cloneState(testCase.state);
  const legacyResult = legacy(legacyState, testCase.playerId, testCase.action);
  const ecsResult = ecs(ecsState, testCase.playerId, testCase.action);
  const projectedLegacy = testCase.project(legacyState);
  const projectedEcs = testCase.project(ecsState);
  const ok = stable(legacyResult) === stable(ecsResult) && stable(projectedLegacy) === stable(projectedEcs);
  return {
    name: testCase.name,
    ok,
    legacyResult,
    ecsResult,
    legacyState: projectedLegacy,
    ecsState: projectedEcs,
    reason: ok ? undefined : "Legacy and ECS action outputs or projected state diverged.",
  };
}

export function runParitySuite<State>(cases: ParityCase<State>[], legacy: LegacyActionRunner<State>, ecs: EcsActionRunner<State>) {
  const results = cases.map((c) => runParityCase(c, legacy, ecs));
  return {
    ok: results.every((r) => r.ok),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
