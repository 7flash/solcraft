import { createMeasure } from "measure-fn";
import { bankStatusForPlayer, exchangeBankStatusForPlayer, ensureDepositWallet, scanBankDeposits, requestBankWithdrawal } from "@server/bank";
import { noStoreHeaders } from "@server/apiGuard";
import { withPlayerApiRoute } from "@server/apiRoute";
import { bankResultMeasureFields, responseMeasureFields } from "@server/measureFields";

const httpMeasure = createMeasure("api.bank", { maxResultLength: 120 });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  let reasonCode = "";
  let measureCtx: any = { route: "/api/bank" };

  return httpMeasure.measure.root({
    start: () => `${req.method} /api/bank`,
    end: (res: Response) => responseMeasureFields(res, measureCtx, { reason: reasonCode }),
    budget: 2500,
    maxResultLength: 120,
  }, async () => withPlayerApiRoute(req, { route: "/api/bank", bodyLimit: 64_000, defaultAction: "status" }, async ({ body, player, ctx, action }) => {
    measureCtx = ctx;
    const bankAction = String(action || "status").slice(0, 32);
    const result = await httpMeasure.measure({
      start: () => `bank uid=${player.id} action=${bankAction}`,
      end: (r: any) => bankResultMeasureFields(r, ctx),
      budget: bankAction === "scan" || bankAction === "withdraw" ? 2600 : 300,
      maxResultLength: 120,
    }, async () => {
      if (bankAction === "status") return bankStatusForPlayer(player);
      if (bankAction === "exchange" || bankAction === "prepare") return await exchangeBankStatusForPlayer(player);
      if (bankAction === "deposit") return await ensureDepositWallet(player);
      if (bankAction === "scan") return await scanBankDeposits(player, Number(body.limit || 50));
      if (bankAction === "withdraw") return await requestBankWithdrawal(player, String(body.amountUi || body.amount || "0"), String(body.to || body.wallet || ""), String(body.idempotencyKey || body.clientRequestId || body.rid || ""));
      return { ok: false, msg: "Unknown bank action", reasonCode: "UNKNOWN_BANK_ACTION" };
    });

    reasonCode = result?.reasonCode || "";
    return Response.json(result, { status: result?.reasonCode === "UNKNOWN_BANK_ACTION" ? 400 : 200, headers: noStoreHeaders() });
  }));
}
