import type { BackendRequestContext } from "./requestContext";
import { contextFields } from "./requestContext";

export type MeasureActivityKind = "request" | "action" | "bank" | "join" | "state" | "wonder" | "admin" | "error" | "system";
export type MeasureActivityRow = {
  id: number;
  ts: number;
  kind: string;
  name: string;
  rid: string;
  uid: number;
  wallet: string;
  route: string;
  action: string;
  backend: string;
  ok: boolean;
  status: number;
  reason: string;
  ms: number;
  fields: Record<string, any>;
};

const RING_MAX = Math.max(200, Math.min(10000, Number(process.env.SOLCRAFT_MEASURE_RING_MAX || process.env.SOLCRAFT_ACTIVITY_RING_MAX || 2500) || 2500));
const ring: MeasureActivityRow[] = [];
let seq = 1;

const SENSITIVE = /secret|signature|challenge|authorization|auth|token|private|password|faceImage|image/i;

function short(v: any, max = 220) {
  return String(v ?? "").replace(/[\r\n\t]+/g, " ").slice(0, max);
}

function scalar(v: any): any {
  if (v == null) return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return short(v, 240);
  if (typeof v === "bigint") return v.toString();
  return undefined;
}

export function sanitizeMeasureFields(input: Record<string, any> = {}) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (SENSITIVE.test(k)) { out[k] = "[redacted]"; continue; }
    const s = scalar(v);
    if (s !== undefined) out[k] = s;
    else if (Array.isArray(v)) out[k] = { length: v.length };
    else if (v && typeof v === "object") out[k] = { keys: Object.keys(v).slice(0, 10) };
  }
  return out;
}

export function captureMeasureActivity(name: string, ctx: Partial<BackendRequestContext> = {}, fields: Record<string, any> = {}, kind: MeasureActivityKind | string = "request") {
  const base = contextFields(ctx);
  const safe = sanitizeMeasureFields({ ...base, ...fields });
  const row: MeasureActivityRow = {
    id: seq++,
    ts: Date.now(),
    kind: short(kind || safe.kind || "request", 40),
    name: short(name || safe.name || "measure", 80),
    rid: short(safe.rid || ctx.requestId || "", 40),
    uid: Math.max(0, Math.trunc(Number(safe.uid || ctx.playerId || 0)) || 0),
    wallet: short((ctx as any).wallet || safe.wallet || "", 64),
    route: short(safe.route || ctx.route || "", 96),
    action: short(safe.action || ctx.action || "", 48),
    backend: short(safe.backend || ctx.backend || "", 24),
    ok: safe.ok === false ? false : !!safe.ok,
    status: Math.trunc(Number(safe.status || 0)) || 0,
    reason: short(safe.reason || safe.reasonCode || "", 48),
    ms: Math.max(0, Math.trunc(Number(safe.ms || 0)) || 0),
    fields: safe,
  };
  ring.push(row);
  while (ring.length > RING_MAX) ring.shift();
  return row;
}

export function queryMeasureActivity(opts: { playerId?: any; uid?: any; wallet?: string; action?: string; kind?: string; route?: string; name?: string; limit?: any } = {}) {
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(opts.limit || 100))));
  const pidRaw = opts.playerId ?? opts.uid;
  const pid = pidRaw == null || pidRaw === "" ? 0 : Math.trunc(Number(pidRaw || 0));
  const wallet = short(opts.wallet || "", 64).toLowerCase();
  const action = short(opts.action || "", 48);
  const kind = short(opts.kind || "", 40);
  const route = short(opts.route || "", 96);
  const name = short(opts.name || "", 80);
  const rows = ring.filter((r) => {
    if (pid && r.uid !== pid) return false;
    if (wallet && !r.wallet.toLowerCase().includes(wallet)) return false;
    if (action && r.action !== action) return false;
    if (kind && r.kind !== kind) return false;
    if (route && !r.route.includes(route)) return false;
    if (name && !r.name.includes(name)) return false;
    return true;
  }).slice(-limit).reverse();
  return { rows, summary: measureActivitySummary() };
}

export function measureActivitySummary() {
  const byAction: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  let failed = 0;
  for (const r of ring) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    if (r.route) byRoute[r.route] = (byRoute[r.route] || 0) + 1;
    if (r.action) byAction[r.action] = (byAction[r.action] || 0) + 1;
    if (!r.ok || r.reason) {
      failed++;
      byReason[r.reason || `HTTP_${r.status || 0}`] = (byReason[r.reason || `HTTP_${r.status || 0}`] || 0) + 1;
    }
  }
  return { total: ring.length, max: RING_MAX, failed, byKind, byRoute, byAction, byReason };
}

export function measureConsoleError(name: string, ctx: Partial<BackendRequestContext>, error: any, fields: Record<string, any> = {}) {
  const msg = short(error?.message || error || "error");
  const safe = sanitizeMeasureFields({ ...contextFields(ctx), ...fields, ok: false, msg, reason: fields.reason || fields.reasonCode || error?.reasonCode || "ERROR" });
  console.error(`[solcraft] ${name}`, safe);
  return captureMeasureActivity(name, ctx, safe, "error");
}


export function recentMeasureActivity(limit = 50) {
  const n = Math.max(1, Math.min(200, Math.trunc(Number(limit || 50))));
  return ring.slice(-n).reverse();
}
