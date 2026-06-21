import * as legacy from "./engine";
import * as ecs from "./ecsBackend";

export type BackendMode = "legacy" | "hybrid" | "ecs";

export function backendMode(): BackendMode {
  const raw = String(process.env.SOLCRAFT_BACKEND_MODE || process.env.SOLCRAFT_AUTHORITY || "legacy").trim().toLowerCase();
  if (raw === "ecs") return "ecs";
  if (raw === "hybrid" || raw === "ecs-hybrid") return "hybrid";
  return "legacy";
}

export function activeBackendName() { return backendMode(); }
export function usingEcsBackend() { return backendMode() !== "legacy"; }

function allowFallback() {
  return backendMode() === "hybrid" || process.env.SOLCRAFT_ECS_FALLBACK === "1";
}

export function auth(pid: number, secret: string) {
  return usingEcsBackend() ? ecs.auth(pid, secret) : legacy.auth(pid, secret);
}

export async function join(name: string, body: number, hat: number, walletAuth: any, appearance?: any) {
  return usingEcsBackend() ? ecs.join(name, body, hat, walletAuth, appearance) : legacy.join(name, body, hat, walletAuth, appearance);
}

export function joinSpectator(name = "Spectator", appearance?: any) {
  return usingEcsBackend() ? ecs.joinSpectator(name, appearance) : legacy.joinSpectator(name, appearance);
}

export function snapshot(p: any, q: { rev: number; ax: number; az: number; chat: number; mapRev?: number }) {
  return usingEcsBackend() ? ecs.snapshot(p, q) : legacy.snapshot(p, q);
}

export function dispatch(p: any, body: any) {
  if (!usingEcsBackend()) return legacy.dispatch(p, body);
  const r = ecs.dispatch(p, body);
  if (r?.ok === false && r?.reasonCode === "ECS_ACTION_NOT_IMPLEMENTED" && allowFallback()) {
    const lr = legacy.dispatch(p, body);
    return { ...lr, backend: "legacy-fallback", ecsFallback: true };
  }
  return r;
}

export function ensureWorldTickStarted() {
  return usingEcsBackend() ? ecs.ensureWorldTickStarted() : legacy.ensureWorldTickStarted();
}

export function worldTickStatus() {
  const mode = backendMode();
  return mode === "legacy" ? { mode, ...legacy.worldTickStatus() } : { mode, ...ecs.worldTickStatus(), legacy: mode === "hybrid" ? legacy.worldTickStatus() : undefined };
}

export function forceClientRefresh(reason = "Admin published an update") {
  return usingEcsBackend() ? ecs.forceClientRefresh(reason) : legacy.forceClientRefresh(reason);
}

export function backendStatus() {
  return {
    mode: backendMode(),
    ecs: ecs.ecsBackendStatus(),
    legacy: backendMode() === "legacy" || backendMode() === "hybrid" ? legacy.worldTickStatus() : undefined,
    fallback: allowFallback(),
  };
}
