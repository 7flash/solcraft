import { createMeasure } from "measure-fn";
import { activeBackendName, ensureWorldTickStarted, join, joinSpectator } from "@server/backend";
import { jsonError, noStoreHeaders, readJsonLimited } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";
import { createRequestContext, withRequestContext } from "@server/requestContext";
import { measureConsoleError } from "@server/measureActivity";
import { joinResultMeasureFields, responseMeasureFields } from "@server/measureFields";

const httpMeasure = createMeasure("api.join", { maxResultLength: 120 });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function remoteKey(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: Request) {
  ensureWorldTickStarted();
  let body: any = {};
  let ctx = createRequestContext(req, { route: "/api/join", backend: activeBackendName() });
  let reasonCode = "";
  return httpMeasure.measure.root({
    start: () => "POST /api/join",
    end: (res: Response) => responseMeasureFields(res, ctx, { reason: reasonCode }),
    budget: 650,
    maxResultLength: 120,
  }, async () => {
    try {
      body = await readJsonLimited(req, 64_000);
      const action = body?.spectator ? "spectator" : "wallet";
      ctx = withRequestContext(ctx, { action });
      const limit = checkRateLimit(`join:${remoteKey(req)}`, { capacity: 8, refillPerSec: 0.2, cost: body?.spectator ? 0.35 : 1 });
      if (!limit.ok) {
        reasonCode = "RATE_LIMITED";
        return jsonError("Too many join attempts. Try again in a moment.", { status: 429, reasonCode: "RATE_LIMITED", headers: rateLimitHeaders(limit) });
      }
      const result = await httpMeasure.measure({
        start: () => body?.spectator ? "join spectator" : "join wallet",
        end: (r: any) => joinResultMeasureFields(r, ctx),
        budget: body?.spectator ? 100 : 600,
        maxResultLength: 120,
      }, async () => {
        if (body.spectator) return joinSpectator(String(body.name || "Spectator").slice(0, 24), body.appearance);
        return await join(String(body.name || "").slice(0, 24), Number(body.body) || 0x6a5ae0, Number(body.hat) || 0x14f195, body.walletAuth, body.appearance, body.referralCode || body.inviteCode);
      });
      if (!result) {
        reasonCode = "JOIN_FAILED";
        return Response.json({ ok: false, msg: "join failed", reasonCode: "JOIN_FAILED" }, { status: 500, headers: noStoreHeaders() });
      }
      ctx = withRequestContext(ctx, { playerId: result.id || 0, wallet: result.wallet || "" });
      return Response.json({ ok: true, ...result }, { headers: noStoreHeaders() });
    } catch (e: any) {
      reasonCode = e?.reasonCode || e?.details?.reasonCode || "JOIN_FAILED";
      measureConsoleError("api.join.failed", ctx, e, { reasonCode });
      return Response.json({ ok: false, msg: e?.message || "join failed", reasonCode: e?.reasonCode || e?.details?.reasonCode || "JOIN_FAILED", details: e?.details || null }, { status: e?.status || 401, headers: noStoreHeaders() });
    }
  });
}