import { createMeasure } from "measure-fn";
import { createReferralCode, deactivateReferralCode, referralStatusForPlayer } from "@server/referralProgram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const httpMeasure = createMeasure("api.referrals", { maxResultLength: 140 });

async function readBody(req: Request) {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  return await req.json().catch(() => ({}));
}
async function loadAuth() {
  try { return (await import("@server/backend")) as any; }
  catch { return (await import("@server/engine")) as any; }
}
function secretFrom(req: Request, body: any) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(body.secret || bearer || "");
}
function pidFrom(req: Request, body: any) {
  return Number(body.pid || body.playerId || req.headers.get("x-solcraft-player") || 0) || 0;
}
function noStore(status = 200) { return { status, headers: { "Cache-Control": "no-store" } }; }

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

async function handle(req: Request) {
  const body: any = await readBody(req);
  const pid = pidFrom(req, body);
  const action = String(body.action || (req.method === "GET" ? "status" : "create"));
  return httpMeasure.measure.root({
    start: () => `${req.method} /api/referrals uid=${pid || "?"} action=${action}`,
    end: (res: Response) => ({ status: res.status, ok: res.ok, uid: pid || null, action }),
    budget: 140,
    maxResultLength: 120,
  }, async () => {
    const { auth } = await loadAuth();
    const p = auth(pid, secretFrom(req, body));
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, noStore(401));

    if (action === "status" || action === "list") return Response.json(referralStatusForPlayer(p), noStore());
    if (action === "create") return Response.json(createReferralCode(p, body), noStore());
    if (action === "deactivate" || action === "pause") return Response.json(deactivateReferralCode(p, body.code), noStore());

    return Response.json({ ok: false, msg: "Unknown referral action", reasonCode: "UNKNOWN_REFERRAL_ACTION" }, noStore(400));
  });
}
