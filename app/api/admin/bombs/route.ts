// @ts-nocheck
import { adminBombsStatus, adminForceResolveBombs } from "@server/engine";
import { requireAdminKey } from "@server/mechanics/playerResources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: Request) {
  return req.method === "GET" ? {} : await req.json().catch(() => ({}));
}
function fail(e: any) {
  return Response.json(
    { ok: false, msg: e?.message || "Bomb admin failed", reasonCode: e?.reasonCode || "BOMB_ADMIN_FAILED" },
    { status: e?.status || 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    requireAdminKey(req, url, {});
    return Response.json(adminBombsStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) { return fail(e); }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await readBody(req);
  try {
    requireAdminKey(req, url, body);
    const action = String(body.action || "resolve");
    if (action === "resolve" || action === "force") return Response.json(adminForceResolveBombs(), { headers: { "Cache-Control": "no-store" } });
    if (action === "status") return Response.json(adminBombsStatus(), { headers: { "Cache-Control": "no-store" } });
    return Response.json({ ok: false, msg: "Unknown bomb admin action", reasonCode: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (e: any) { return fail(e); }
}
