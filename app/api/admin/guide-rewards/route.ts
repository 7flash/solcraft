import { adminResetGuideRewards } from "../../../../game/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredKey() {
  return String(process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || process.env.SOLCRAFT_ADMIN_KEY || process.env.ADMIN_KEY || "").trim();
}

function providedKey(req: Request, url: URL, body: any) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(
    req.headers.get("x-solcraft-admin-key") ||
    req.headers.get("x-admin-key") ||
    bearer ||
    url.searchParams.get("key") ||
    body?.adminKey ||
    body?.key ||
    "",
  ).trim();
}

function unauthorized(msg = "Unauthorized") {
  return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const expected = configuredKey();
  if (!expected) return unauthorized("Admin key is not configured on the server.");
  if (providedKey(req, url, body) !== expected) return unauthorized();

  const playerId = Number(body?.playerId || body?.id || url.searchParams.get("playerId") || url.searchParams.get("id") || 0);
  if (!playerId) return Response.json({ ok: false, reasonCode: "PLAYER_ID_REQUIRED", msg: "playerId is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const result = adminResetGuideRewards(playerId, { clearVisits: !!body?.clearVisits || url.searchParams.get("clearVisits") === "1" });
  return Response.json(result, { status: result.ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
