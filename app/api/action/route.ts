import { createMeasure } from "measure-fn";
import { activeBackendName, auth, dispatch, ensureWorldTickStarted } from "@server/backend";
import { actionRatePolicy, validateActionBody } from "@server/actionValidation";
import { jsonError, noStoreHeaders, playerIdFrom, readJsonLimited, secretFrom } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";
import { createRequestContext, withRequestContext } from "@server/requestContext";
import { measureConsoleError } from "@server/measureActivity";
import { actionResultMeasureFields, responseMeasureFields } from "@server/measureFields";

const httpMeasure = createMeasure("api.action", { maxResultLength: 120 });

export async function POST(req: Request) {
  ensureWorldTickStarted();
  let body: any = {};
  let playerId = 0;
  let ctx = createRequestContext(req, { route: "/api/action", backend: activeBackendName() });
  let reasonCode = "";
  return httpMeasure.measure.root({
    start: () => `POST /api/action uid=${playerId || 0} action=${String(body?.type || "?")}`,
    end: (res: Response) => responseMeasureFields(res, ctx, { reason: reasonCode }),
    budget: 140,
    maxResultLength: 120,
  }, async () => {
    try {
      try {
        body = await readJsonLimited(req, 260_000);
      } catch (e: any) {
        reasonCode = e?.reasonCode || "BAD_JSON";
        return jsonError(e?.message || "Bad request body.", { status: e?.status || 400, reasonCode: e?.reasonCode || "BAD_JSON" });
      }

      playerId = playerIdFrom(req, body.pid);
      ctx = withRequestContext(ctx, { playerId, action: String(body?.type || "") });
      const p = auth(playerId, String(secretFrom(req, body.secret || "")));
      if (!p) {
        reasonCode = "AUTH";
        return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: noStoreHeaders() });
      }
      ctx = withRequestContext(ctx, { playerId: p.id, wallet: p.wallet || "", action: String(body?.type || "") });

      const validated = validateActionBody({ ...body, pid: p.id });
      if (!validated.ok) {
        reasonCode = validated.reasonCode;
        return jsonError(validated.msg, { status: 400, reasonCode: validated.reasonCode });
      }
      body = validated.body;
      ctx = withRequestContext(ctx, { action: String(body.type || "") });

      const totalLimit = checkRateLimit(`action:${p.id}`, { capacity: 60, refillPerSec: 16, cost: 1 });
      if (!totalLimit.ok) {
        reasonCode = "RATE_LIMITED";
        return jsonError("Too many actions. Slow down for a moment.", { status: 429, reasonCode: "RATE_LIMITED", headers: rateLimitHeaders(totalLimit) });
      }
      const actionLimit = checkRateLimit(`action:${p.id}:${String(body.type || "")}`, actionRatePolicy(String(body.type || "")));
      if (!actionLimit.ok) {
        reasonCode = "RATE_LIMITED";
        return jsonError("That action is being used too quickly.", { status: 429, reasonCode: "RATE_LIMITED", headers: rateLimitHeaders(actionLimit) });
      }

      const result = await httpMeasure.measure({
        start: () => `dispatch uid=${p.id} action=${String(body?.type || "?")}`,
        end: (r: any) => actionResultMeasureFields(r, ctx),
        budget: 40,
        maxResultLength: 120,
      }, async () => dispatch(p, body));
      const out = result ?? { ok: false, msg: "action failed", reasonCode: "ACTION_FAILED" };
      reasonCode = out.reasonCode || "";
      return Response.json(out, { headers: noStoreHeaders() });
    } catch (e: any) {
      reasonCode = e?.reasonCode || "ACTION_FAILED";
      measureConsoleError("api.action.failed", ctx, e, { reasonCode });
      return jsonError("Action failed.", { status: 500, reasonCode: e?.reasonCode || "ACTION_FAILED" });
    }
  });
}
