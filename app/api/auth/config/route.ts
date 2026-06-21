import { createMeasure } from "measure-fn";
import { publicLoginGateSettings } from "@server/login-gate";

const httpMeasure = createMeasure("http", { maxResultLength: 140 });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return httpMeasure.measure.root({
    start: () => "GET /api/auth/config",
    end: (res: Response) => ({ status: res.status, ok: res.ok }),
    budget: 80,
  }, async () => Response.json({ ok: true, loginGate: publicLoginGateSettings() }));
}
