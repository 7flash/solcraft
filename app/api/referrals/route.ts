import { createMeasure } from "measure-fn";
import { auth } from "@server/ecsBackend";
import { createReferralCode, deactivateReferralCode, referralStatusForPlayer } from "@server/referralProgram";

const httpMeasure = createMeasure("api.referrals", { maxResultLength: 140 });

type ReferralBody = Record<string, unknown>;

function noStore(status = 200) {
  return { status, headers: { "Cache-Control": "no-store" } };
}

async function readBody(req: Request): Promise<ReferralBody> {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  return await req.json().catch(() => ({}));
}

function secretFrom(req: Request, body: ReferralBody) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  return String(body.secret || bearer || "");
}

function pidFrom(req: Request, body: ReferralBody) {
  return Number(body.pid || body.playerId || req.headers.get("x-solcraft-player") || 0) || 0;
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const body = await readBody(req);
  const pid = pidFrom(req, body);
  const action = String(body.action || (req.method === "GET" ? "status" : "create"));

  return httpMeasure.measure.root({
    start: () => `${req.method} /api/referrals uid=${pid || "?"} action=${action}`,
    end: (res: Response) => ({ status: res.status, ok: res.ok, uid: pid || null, action }),
    budget: 140,
    maxResultLength: 120,
  }, async () => {
    const p = auth(pid, secretFrom(req, body));
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, noStore(401));

    if (action === "status" || action === "list") return Response.json(referralStatusForPlayer(p), noStore());
    if (action === "create") return Response.json(createReferralCode(p, body), noStore());
    if (action === "deactivate" || action === "pause") return Response.json(deactivateReferralCode(p, body.code), noStore());

    return Response.json({ ok: false, msg: "Unknown referral action", reasonCode: "UNKNOWN_REFERRAL_ACTION" }, noStore(400));
  });
}
