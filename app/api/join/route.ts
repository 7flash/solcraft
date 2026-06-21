import { createMeasure } from "measure-fn";
import { join, joinSpectator } from "@server/engine";

const httpMeasure = createMeasure("http", { maxResultLength: 160 });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};
  return httpMeasure.measure.root({
    start: () => "POST /api/join",
    end: (res: Response) => ({ status: res.status, ok: res.ok }),
    budget: 650,
    maxResultLength: 120,
  }, async () => {
    try {
      body = await req.json().catch(() => ({}));
      const result = await httpMeasure.measure({
        start: () => body?.spectator ? "join spectator" : "join wallet",
        end: (r: any) => ({ ok: !!r?.id, id: r?.id, existing: !!r?.existing, needsProfile: !!r?.needsProfile, spectator: !!r?.spectator, tokenGate: !!r?.loginGate?.enabled }),
        budget: body?.spectator ? 100 : 600,
        maxResultLength: 140,
      }, async () => {
        if (body.spectator) return joinSpectator(String(body.name || "Spectator"), body.appearance);
        return await join(
          String(body.name || ""),
          Number(body.body) || 0x6a5ae0,
          Number(body.hat) || 0x14f195,
          body.walletAuth,
          body.appearance,
        );
      });
      if (!result) return Response.json({ ok: false, msg: "join failed", reasonCode: "JOIN_FAILED" }, { status: 500 });
      return Response.json({ ok: true, ...result });
    } catch (e: any) {
      return Response.json({ ok: false, msg: e?.message || "join failed", reasonCode: e?.reasonCode || e?.details?.reasonCode || "JOIN_FAILED", details: e?.details || null }, { status: 401 });
    }
  });
}
