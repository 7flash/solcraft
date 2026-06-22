import * as ecs from "./ecsBackend";

export type BackendMode = "ecs";
export function backendMode(): BackendMode { return "ecs"; }
export function activeBackendName() { return "ecs"; }
export function usingEcsBackend() { return true; }

export const auth = ecs.auth;
export const join = ecs.join;
export const joinSpectator = ecs.joinSpectator;
export const snapshot = ecs.snapshot;
export const dispatch = ecs.dispatch;
export const forceClientRefresh = ecs.forceClientRefresh;

export function ensureWorldTickStarted() {
  try {
    return ecs.ensureWorldTickStarted?.();
  } catch (e: any) {
    // Do not let a staged tick bootstrap issue break /api/state. Gameplay actions
    // and snapshots remain authoritative; tick repair can happen independently.
    console.warn("[solcraft] ecs.tick.start.failed", String(e?.message || e || "tick start failed"));
    return { ok: false, skipped: true, reason: "ECS_TICK_START_FAILED", msg: String(e?.message || e || "tick start failed") };
  }
}

export function worldTickStatus() {
  try { return { mode: "ecs", ...ecs.worldTickStatus?.() }; }
  catch (e: any) { return { mode: "ecs", ok: false, reason: "ECS_TICK_STATUS_FAILED", msg: String(e?.message || e || "tick status failed") }; }
}

export function backendStatus() {
  return { mode: "ecs", ecs: ecs.ecsBackendStatus?.(), fallback: false };
}
