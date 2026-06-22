import { createMeasure } from "measure-fn";
import { adminCreateReferralCode, adminReferralDashboard, adminSetReferralCodeState } from "@server/referralProgram";

const httpMeasure = createMeasure("api.admin.referrals", { maxResultLength: 120 });

type AdminBody = Record<string, unknown>;

function configuredKey() {
  return String(process.env.SOLCRAFT_ADMIN_KEY || process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || process.env.ADMIN_KEY || "").trim();
}

function providedKey(req: Request, body: AdminBody) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  return String(req.headers.get("x-solcraft-admin-key") || req.headers.get("x-admin-key") || bearer || body.adminKey || body.key || "").trim();
}

function noStore(status = 200) {
  return { status, headers: { "Cache-Control": "no-store" } };
}

function unauthorized(msg = "Unauthorized") {
  return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg }, noStore(401));
}

async function readBody(req: Request): Promise<AdminBody> {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  return await req.json().catch(() => ({}));
}

function adminIdentity(req: Request) {
  return { name: req.headers.get("x-admin-name") || "admin", key: "admin" };
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const body = await readBody(req);
  const action = String(body.action || "dashboard");

  return httpMeasure.measure.root({
    start: () => `${req.method} /api/admin/referrals action=${action}`,
    end: (res: Response) => ({ status: res.status, ok: res.ok, action }),
    budget: 180,
    maxResultLength: 100,
  }, async () => {
    const expected = configuredKey();
    if (!expected) return unauthorized("Admin key is not configured.");
    if (providedKey(req, body) !== expected) return unauthorized();

    if (action === "dashboard" || action === "list") return Response.json(adminReferralDashboard(body), noStore());
    if (action === "create") return Response.json(adminCreateReferralCode(adminIdentity(req), body), noStore());
    if (action === "update" || action === "disable" || action === "enable") return Response.json(adminSetReferralCodeState(adminIdentity(req), body), noStore());

    return Response.json({ ok: false, reasonCode: "UNKNOWN_ADMIN_REFERRAL_ACTION", msg: "Unknown referral admin action." }, noStore(400));
  });
}
