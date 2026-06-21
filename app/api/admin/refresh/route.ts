// @ts-nocheck
import { forceClientRefresh, clientRequiredVersion, clientUpdateReason } from "@server/engine";
import { requireAdminKey } from "@server/mechanics/playerResources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function body(req: Request) { return req.method === "GET" ? {} : await req.json().catch(() => ({})); }
function fail(e: any) {
  return Response.json({ ok: false, msg: e?.message || "Refresh admin failed", reasonCode: e?.reasonCode || "REFRESH_ADMIN_FAILED" }, { status: e?.status || 500, headers: { "Cache-Control": "no-store" } });
}
export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    requireAdminKey(req, url, {});
    return Response.json({ ok: true, version: clientRequiredVersion(), reason: clientUpdateReason() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) { return fail(e); }
}
export async function POST(req: Request) {
  const url = new URL(req.url);
  const b = await body(req);
  try {
    requireAdminKey(req, url, b);
    const reason = String(b.reason || "A SolCraft update landed. Refresh once so the client and server agree.");
    const result = forceClientRefresh(reason);
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) { return fail(e); }
}
