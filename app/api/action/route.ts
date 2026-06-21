import { createMeasure } from "measure-fn";
import { auth, dispatch, ensureWorldTickStarted } from "@server/engine";

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
    body = await req.json().catch(() => ({}));
    playerId = Number(body.pid) || 0;
    const p = auth(playerId, String(body.secret || ""));
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401 });
    const result = await httpMeasure.measure({
      start: () => `dispatch ${String(body?.type || "?")} player=${p.id}`,
      end: (r: any) => actionMeasureFields(r, body, p),
      budget: 40,
      maxResultLength: 160,
    }, async () => dispatch(p, body));
    return Response.json(result ?? { ok: false, msg: "action failed", reasonCode: "ACTION_FAILED" });
  });
}