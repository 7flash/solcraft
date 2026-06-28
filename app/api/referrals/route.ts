import { createMeasure } from "measure-fn";
import { createReferralCode, deactivateReferralCode, referralStatusForPlayer } from "@server/referralProgram";
import { noStoreHeaders } from "@server/apiGuard";
import { withPlayerApiRoute } from "@server/apiRoute";

const httpMeasure = createMeasure("api.referrals", { maxResultLength: 140 });

function noStore(status = 200) {
  return { status, headers: noStoreHeaders() };
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  let action = req.method === "GET" ? "status" : "create";

  return httpMeasure.measure.root({
    start: () => `${req.method} /api/referrals action=${action}`,
    end: (res: Response) => ({ status: res.status, ok: res.ok, action }),
    budget: 140,
    maxResultLength: 120,
  }, async () => withPlayerApiRoute(req, { route: "/api/referrals", bodyLimit: 64_000, defaultAction: action }, async ({ body, player }) => {
    action = String(body.action || action);

    if (action === "status" || action === "list") return Response.json(referralStatusForPlayer(player), noStore());
    if (action === "create") return Response.json(createReferralCode(player, body), noStore());
    if (action === "deactivate" || action === "pause") return Response.json(deactivateReferralCode(player, body.code), noStore());

    return Response.json({ ok: false, msg: "Unknown referral action", reasonCode: "UNKNOWN_REFERRAL_ACTION" }, noStore(400));
  }));
}
