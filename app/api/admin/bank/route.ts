// @ts-nocheck
import { createMeasure } from "measure-fn";
import { requireAdminKey } from "@server/mechanics/playerResources";
import {
  bankAdminStatus,
  setBankSettings,
  adminBankScanAllDeposits,
  adminBankCheckWithdraw,
  adminBankSweepDeposit,
  adminBankCheckBalances,
  adminBankProcessPendingWithdrawals,
} from "@server/bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const httpMeasure = createMeasure("http.admin.bank", { maxResultLength: 220 });

async function readBody(req: Request) {
  if (req.method === "GET") return {};
  return await req.json().catch(() => ({}));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return httpMeasure.measure.root({ start: () => "GET /api/admin/bank", end: (r: Response) => ({ status: r.status, ok: r.ok }), budget: 1200 }, async () => {
    try {
      requireAdminKey(req, url, {});
      return Response.json({ ok: true, bank: bankAdminStatus() });
    } catch (e: any) {
      return Response.json({ ok: false, msg: e?.message || "admin bank failed", reasonCode: e?.reasonCode || "ADMIN_BANK_FAILED" }, { status: e?.status || 401 });
    }
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body: any = await readBody(req);
  return httpMeasure.measure.root({ start: () => `POST /api/admin/bank ${String(body.action || "")}`, end: (r: Response) => ({ status: r.status, ok: r.ok }), budget: 2500 }, async () => {
    try {
      requireAdminKey(req, url, body);
      const action = String(body.action || "status");
      if (action === "status") return Response.json({ ok: true, bank: bankAdminStatus() });
      if (action === "save-bank") return Response.json({ ok: true, ...(setBankSettings(body.bank || {})), bank: bankAdminStatus() });
      if (action === "scan-all") return Response.json(await adminBankScanAllDeposits(Number(body.limit || 50)));
      if (action === "check-withdraw" || action === "dry-run-withdraw") return Response.json(await adminBankCheckWithdraw(String(body.to || ""), String(body.amountUi || body.amount || "0")));
      if (action === "sweep-deposit") return Response.json(await adminBankSweepDeposit(String(body.deposit || "")));
      if (action === "check-balances") return Response.json(await adminBankCheckBalances());
      if (action === "process-withdrawals") return Response.json(await adminBankProcessPendingWithdrawals(Number(body.limit || 25)));
      return Response.json({ ok: false, msg: "Unknown admin bank action", reasonCode: "UNKNOWN_BANK_ACTION" }, { status: 400 });
    } catch (e: any) {
      return Response.json({ ok: false, msg: e?.message || "admin bank failed", reasonCode: e?.reasonCode || "ADMIN_BANK_FAILED" }, { status: e?.status || 401 });
    }
  });
}
