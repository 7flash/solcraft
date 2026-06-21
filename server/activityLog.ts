// Compatibility facade after Stage 25.
// Runtime activity is now captured from measure-fn root/end callbacks via measureFields.ts.
import type { BackendRequestContext } from "./requestContext";
import { captureMeasureActivity, measureActivitySummary, measureConsoleError, queryMeasureActivity, sanitizeMeasureFields } from "./measureActivity";

export type ActivityKind = "request" | "action" | "auth" | "bank" | "admin" | "worldTick" | "error" | "system";
export type ActivityRecord = ReturnType<typeof captureMeasureActivity>;

export function sanitizeActivityFields(input: Record<string, any> = {}) { return sanitizeMeasureFields(input); }
export function recordActivity(ctx: Partial<BackendRequestContext>, kind: ActivityKind | string, fields: Record<string, any> = {}) { return captureMeasureActivity(String(kind || "request"), ctx, fields, kind); }
export function logInfo(ctx: Partial<BackendRequestContext>, event: string, fields: Record<string, any> = {}) { return captureMeasureActivity(event, ctx, { ...fields, ok: fields.ok !== false }, fields.kind || "system"); }
export function logError(ctx: Partial<BackendRequestContext>, event: string, error: any, fields: Record<string, any> = {}) { return measureConsoleError(event, ctx, error, fields); }
export function queryActivity(opts: any = {}) { return queryMeasureActivity(opts); }
export function activitySummary() { return measureActivitySummary(); }
