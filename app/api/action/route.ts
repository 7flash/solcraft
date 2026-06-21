import { createMeasure } from "measure-fn";
import { auth, dispatch, ensureWorldTickStarted } from "@server/backend";
import { actionRatePolicy, validateActionBody } from "@server/actionValidation";
import { jsonError, noStoreHeaders, playerIdFrom, readJsonLimited, secretFrom } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";

const httpMeasure = createMeasure("http", { maxResultLength: 180 });

function actionMeasureFields(result: any, body: any, p: any) {
  return {
    status: result?.ok === false ? 400 : 200,
    ok: !!result?.ok,
    type: String(body?.type || ""),
    player: p?.id,
    reasonCode: result?.reasonCode || null,
    msg: result?.ok ? undefined : result?.msg,
    note: result?.note ? String(result.note).slice(0, 80) : undefined,
    hasState: !!result?.state,
  };
}

export async function POST(req: Request) {
  ensureWorldTickStarted();
  let body: any = {};
  let playerId = 0;
  return httpMeasure.measure.root({
    start: () => `POST /api/action type=${String(body?.type || "?")} pid=${playerId || "?"}`,
    end: (res: Response) => ({ status: res.status, ok: res.ok }),
    budget: 140,
    maxResultLength: 140,
  }, async () => {
    try {
      body = await readJsonLimited(req, 260_000);
    } catch (e: any) {
      return jsonError(e?.message || "Bad request body.", { status: e?.status || 400, reasonCode: e?.reasonCode || "BAD_JSON" });
    }

    playerId = playerIdFrom(req, body.pid);
    const p = auth(playerId, String(secretFrom(req, body.secret || "")));
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: noStoreHeaders() });

    const validated = validateActionBody({ ...body, pid: p.id });
    if (!validated.ok) return jsonError(validated.msg, { status: 400, reasonCode: validated.reasonCode });
    body = validated.body;

    const totalLimit = checkRateLimit(`action:${p.id}`, { capacity: 60, refillPerSec: 16, cost: 1 });
    if (!totalLimit.ok) return jsonError("Too many actions. Slow down for a moment.", { status: 429, reasonCode: "RATE_LIMITED", headers: rateLimitHeaders(totalLimit) });
    const actionLimit = checkRateLimit(`action:${p.id}:${String(body.type || "")}`, actionRatePolicy(String(body.type || "")));
    if (!actionLimit.ok) return jsonError("That action is being used too quickly.", { status: 429, reasonCode: "RATE_LIMITED", headers: rateLimitHeaders(actionLimit) });

    const result = await httpMeasure.measure({
      start: () => `dispatch ${String(body?.type || "?")} player=${p.id}`,
      end: (r: any) => actionMeasureFields(r, body, p),
      budget: 40,
      maxResultLength: 160,
    }, async () => dispatch(p, body));
    return Response.json(result ?? { ok: false, msg: "action failed", reasonCode: "ACTION_FAILED" }, { headers: noStoreHeaders() });
  });
}
