import type { BackendRequestContext } from "./requestContext";
import { contextFields, elapsedMs } from "./requestContext";
import { captureMeasureActivity } from "./measureActivity";

export function responseMeasureFields(res: Response, ctx: Partial<BackendRequestContext> = {}, extra: Record<string, any> = {}) {
  const fields = { ...contextFields(ctx), status: res.status, ok: res.ok, reason: extra.reason || extra.reasonCode || "", ms: elapsedMs(ctx), ...extra };
  const kind = routeKind(ctx.route || "request");
  if (!(kind === "state" && res.ok && !extra.sampled)) captureMeasureActivity("response", ctx, fields, kind);
  return fields;
}

export function actionResultMeasureFields(result: any, ctx: Partial<BackendRequestContext> = {}, extra: Record<string, any> = {}) {
  const fields = {
    ...contextFields(ctx),
    ok: !!result?.ok,
    reason: result?.reasonCode || extra.reason || extra.reasonCode || null,
    hasState: !!result?.state,
    rev: result?.state?.rev || result?.snap?.rev || undefined,
    note: result?.note ? String(result.note).slice(0, 64) : undefined,
    ms: elapsedMs(ctx),
    ...extra,
  };
  captureMeasureActivity("action", ctx, fields, "action");
  return fields;
}

export function bankResultMeasureFields(result: any, ctx: Partial<BackendRequestContext> = {}, extra: Record<string, any> = {}) {
  const fields = {
    ...contextFields(ctx),
    ok: !!result?.ok,
    reason: result?.reasonCode || extra.reason || extra.reasonCode || null,
    status: result?.withdrawal?.status || result?.status?.ok || result?.status || undefined,
    deposit: !!result?.deposit,
    withdrawal: result?.withdrawal?.id || undefined,
    ms: elapsedMs(ctx),
    ...extra,
  };
  captureMeasureActivity("bank", ctx, fields, "bank");
  return fields;
}

export function joinResultMeasureFields(result: any, ctx: Partial<BackendRequestContext> = {}, extra: Record<string, any> = {}) {
  const nextCtx = result?.id ? { ...ctx, playerId: result.id, wallet: result.wallet || (ctx as any).wallet } : ctx;
  const fields = {
    ...contextFields(nextCtx),
    ok: !!result?.id,
    uid: result?.id || ctx.playerId || 0,
    existing: !!result?.existing,
    needsProfile: !!result?.needsProfile,
    spectator: !!result?.spectator,
    tokenGate: !!result?.loginGate?.enabled,
    reason: result?.reasonCode || extra.reason || extra.reasonCode || "",
    ms: elapsedMs(ctx),
    ...extra,
  };
  captureMeasureActivity("join", nextCtx, fields, "join");
  return fields;
}

export function routeKind(route: string) {
  if (route.includes("/api/action")) return "action";
  if (route.includes("/api/state")) return "state";
  if (route.includes("/api/join")) return "join";
  if (route.includes("/api/bank")) return "bank";
  if (route.includes("/api/wonder")) return "wonder";
  if (route.includes("/api/admin")) return "admin";
  return "request";
}
