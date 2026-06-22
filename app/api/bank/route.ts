// @ts-nocheck
import { createMeasure } from "measure-fn";
import { activeBackendName, auth } from "@server/backend";
import { bankStatusForPlayer, exchangeBankStatusForPlayer, ensureDepositWallet, scanBankDeposits, requestBankWithdrawal } from "@server/bank";
import { createRequestContext, withRequestContext } from "@server/requestContext";
import { measureConsoleError } from "@server/measureActivity";
import { bankResultMeasureFields, responseMeasureFields } from "@server/measureFields";
import { noStoreHeaders, readJsonLimited, playerIdFrom, secretFrom } from "@server/apiGuard";

const httpMeasure = createMeasure("api.bank", { maxResultLength: 120 });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: Request) { return req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams.entries()) : await readJsonLimited(req, 64_000).catch(() => ({})); }
function playerFrom(req: Request, body: any) {
  const p = auth(playerIdFrom(req, body.pid || body.playerId || 0), String(secretFrom(req, body.secret || "")));
  if (!p) throw Object.assign(new Error("auth"), { reasonCode: "AUTH" });
  return p;
}
export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
async function handle(req: Request) {
  let ctx = createRequestContext(req, { route: "/api/bank", backend: activeBackendName() });
  let reasonCode = "";
  return httpMeasure.measure.root({ start: () => `${req.method} /api/bank uid=${ctx.playerId || 0}`, end: (r: Response) => responseMeasureFields(r, ctx, { reason: reasonCode }), budget: 2500, maxResultLength: 120 }, async () => {
    try {
      const body: any = await readBody(req);
      const action = String(body.action || "status").slice(0, 32);
      ctx = withRequestContext(ctx, { playerId: playerIdFrom(req, body.pid || body.playerId || 0), action });
      const p = playerFrom(req, body);
      ctx = withRequestContext(ctx, { playerId: p.id, wallet: p.wallet || "" });
      const result = await httpMeasure.measure({ start: () => `bank uid=${p.id} action=${action}`, end: (r: any) => bankResultMeasureFields(r, ctx), budget: action === "scan" || action === "withdraw" ? 2600 : 300, maxResultLength: 120 }, async () => {
        if (action === "status") return bankStatusForPlayer(p);
        if (action === "exchange" || action === "prepare") return await exchangeBankStatusForPlayer(p);
        if (action === "deposit") return await ensureDepositWallet(p);
        if (action === "scan") return await scanBankDeposits(p, Number(body.limit || 50));
        if (action === "withdraw") return await requestBankWithdrawal(p, String(body.amountUi || body.amount || "0"), String(body.to || body.wallet || ""), String(body.idempotencyKey || body.clientRequestId || body.rid || ""));
        return { ok: false, msg: "Unknown bank action", reasonCode: "UNKNOWN_BANK_ACTION" };
      });
      reasonCode = result?.reasonCode || "";
      return Response.json(result, { status: result?.reasonCode === "UNKNOWN_BANK_ACTION" ? 400 : 200, headers: noStoreHeaders() });
    } catch (e: any) {
      reasonCode = e?.reasonCode || "BANK_FAILED";
      measureConsoleError("api.bank.failed", ctx, e, { reasonCode });
      return Response.json({ ok: false, msg: e?.message || "bank failed", reasonCode: e?.reasonCode || "BANK_FAILED" }, { status: e?.reasonCode === "AUTH" ? 401 : 500, headers: noStoreHeaders() });
    }
  });
}