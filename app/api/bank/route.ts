// @ts-nocheck
import { createMeasure } from "measure-fn";
import { auth } from "@server/backend";
import { bankStatusForPlayer, exchangeBankStatusForPlayer, ensureDepositWallet, scanBankDeposits, requestBankWithdrawal } from "@server/bank";

const httpMeasure = createMeasure("http.bank", { maxResultLength: 220 });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: Request) { return req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams.entries()) : await req.json().catch(() => ({})); }
function playerFrom(body: any) {
  const p = auth(Number(body.pid || body.playerId || 0), String(body.secret || ""));
  if (!p) throw Object.assign(new Error("auth"), { reasonCode: "AUTH" });
  return p;
}
export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
async function handle(req: Request) {
  return httpMeasure.measure.root({ start: () => `${req.method} /api/bank`, end: (r: Response) => ({ status: r.status, ok: r.ok }), budget: 2500 }, async () => {
    try {
      const body: any = await readBody(req);
      const p = playerFrom(body);
      const action = String(body.action || "status");
      if (action === "status") return Response.json(bankStatusForPlayer(p));
      if (action === "exchange" || action === "prepare") return Response.json(await exchangeBankStatusForPlayer(p));
      if (action === "deposit") return Response.json(await ensureDepositWallet(p));
      if (action === "scan") return Response.json(await scanBankDeposits(p, Number(body.limit || 50)));
      if (action === "withdraw") return Response.json(await requestBankWithdrawal(p, String(body.amountUi || body.amount || "0"), String(body.to || body.wallet || "")));
      return Response.json({ ok: false, msg: "Unknown bank action", reasonCode: "UNKNOWN_BANK_ACTION" }, { status: 400 });
    } catch (e: any) {
      return Response.json({ ok: false, msg: e?.message || "bank failed", reasonCode: e?.reasonCode || "BANK_FAILED" }, { status: e?.reasonCode === "AUTH" ? 401 : 500 });
    }
  });
}