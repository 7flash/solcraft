import { deployReadinessReport } from "@server/deployReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredKey() {
  return String(process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || process.env.SOLCRAFT_ADMIN_KEY || process.env.ADMIN_KEY || "").trim();
}
function providedKey(req: Request, url: URL) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(
    req.headers.get("x-solcraft-admin-key") ||
    req.headers.get("x-admin-key") ||
    bearer ||
    url.searchParams.get("key") ||
    "",
  ).trim();
}
function unauthorized(msg = "Unauthorized") {
  return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = configuredKey();
  if (!expected) return unauthorized("Admin key is not configured on the server.");
  if (providedKey(req, url) !== expected) return unauthorized();

  try {
    const report = await deployReadinessReport();
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return Response.json({ ok: false, reasonCode: "DEPLOY_READINESS_FAILED", msg: String(e?.message || "deploy readiness failed") }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
