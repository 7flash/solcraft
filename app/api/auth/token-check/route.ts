import { createMeasure } from "measure-fn";
import { checkWalletLoginGate } from "../../../../game/login-gate";

const httpMeasure = createMeasure("http", { maxResultLength: 180 });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};
  return httpMeasure.measure.root({
    start: () => "POST /api/auth/token-check",
    end: (res: Response) => ({ status: res.status, ok: res.ok }),
    budget: 550,
  }, async () => {
    body = await req.json().catch(() => ({}));
    const result = await checkWalletLoginGate(String(body.wallet || ""));
    return Response.json(result, { status: result.ok ? 200 : 403 });
  });
}