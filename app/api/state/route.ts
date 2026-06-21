import { createMeasure } from "measure-fn";
import { activeBackendName, auth, ensureWorldTickStarted, snapshot } from "@server/backend";
import { intParam, noStoreHeaders, playerIdFrom, secretFrom } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";
import { createRequestContext, withRequestContext } from "@server/requestContext";
import { responseMeasureFields } from "@server/measureFields";
import { measureConsoleError } from "@server/measureActivity";

export const dynamic = "force-dynamic";

const httpMeasure = createMeasure("api.state", { maxResultLength: 100 });

function stateError(e: any, ctx: any, reasonCode: string) {
  const message = String(e?.message || e || "state failed");
  const malformed = /database disk image is malformed/i.test(message);
  const reason = malformed ? "DB_MALFORMED" : reasonCode || "STATE_FAILED";
  measureConsoleError("api.state.failed", ctx, e, { reasonCode: reason });
  return Response.json({
    ok: false,
    msg: malformed ? "database disk image is malformed" : "state failed",
    reasonCode: reason,
  }, {
    status: malformed ? 503 : 500,
    headers: noStoreHeaders(),
  });
}

export async function GET(req: Request) {
  ensureWorldTickStarted();
  let ctx = createRequestContext(req, { route: "/api/state", backend: activeBackendName(), action: "snapshot" });
  let reasonCode = "";
  let sampled = false;
  return httpMeasure.measure.root({
    start: () => `GET /api/state uid=${ctx.playerId || 0}`,
    end: (res: Response) => responseMeasureFields(res, ctx, { reason: reasonCode, sampled }),
    budget: 85,
    maxResultLength: 100,
  }, async () => {
    try {
      const url = new URL(req.url);
      const pid = playerIdFrom(req, url.searchParams.get("pid") || 0);
      ctx = withRequestContext(ctx, { playerId: pid });
      const secret = secretFrom(req, url.searchParams.get("secret") || "");
      const p = auth(pid, secret);
      if (!p) {
        reasonCode = "AUTH";
        return Response.json({ ok: false, msg: "auth", reasonCode }, { status: 401, headers: noStoreHeaders() });
      }
      ctx = withRequestContext(ctx, { playerId: p.id, wallet: p.wallet || "" });

      const limit = checkRateLimit(`state:${p.id}`, { capacity: 12, refillPerSec: 4, cost: 1 });
      if (!limit.ok) {
        reasonCode = "RATE_LIMITED";
        return Response.json({ ok: false, msg: "State polling is too frequent.", reasonCode }, { status: 429, headers: noStoreHeaders(rateLimitHeaders(limit)) });
      }

      const q = {
        rev: intParam(url, "rev", 0, 0, 2_147_483_647) || 0,
        ax: intParam(url, "ax", 1000000),
        az: intParam(url, "az", 1000000),
        chat: intParam(url, "chat", 0, 0, 2_147_483_647) || 0,
        mapRev: intParam(url, "mapRev", -1, -1, 2_147_483_647),
      };
      const snap = snapshot(p, q);
      sampled = Math.random() < 0.03;
      return Response.json({ ok: true, snap }, { headers: noStoreHeaders() });
    } catch (e: any) {
      reasonCode = e?.reasonCode || "STATE_FAILED";
      return stateError(e, ctx, reasonCode);
    }
  });
}
