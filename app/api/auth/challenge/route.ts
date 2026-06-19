import { createMeasure } from "measure-fn";
import { createWalletChallenge } from "../../../../game/wallet-auth";
import { publicLoginGateSettings } from "../../../../game/login-gate";

const httpMeasure = createMeasure("http", { maxResultLength: 140 });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};
  return httpMeasure.measure.root({
    start: () => "POST /api/auth/challenge",
    end: (res: Response) => ({ status: res.status, ok: res.ok }),
    budget: 100,
    maxResultLength: 120,
  }, async () => {
    try {
      body = await req.json().catch(() => ({}));
      const result = await httpMeasure.measure({
        start: () => `wallet auth challenge ${String(body.wallet || "").slice(0, 6)}…`,
        end: (r: any) => ({ ok: !!r?.message, wallet: String(body.wallet || "").slice(0, 6) + "…" }),
        budget: 60,
        maxResultLength: 120,
      }, async () => createWalletChallenge(String(body.wallet || "")));
      return Response.json({ ok: true, ...result, loginGate: publicLoginGateSettings() });
    } catch (e: any) {
      return Response.json({ ok: false, msg: e?.message || "wallet challenge failed", reasonCode: "WALLET_CHALLENGE_FAILED" }, { status: 400 });
    }
  });
}
