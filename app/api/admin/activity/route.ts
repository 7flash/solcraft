import { jsonError, jsonOk } from "@server/apiGuard";
import { queryMeasureActivity, measureActivitySummary, captureMeasureActivity } from "@server/measureActivity";
import { createRequestContext } from "@server/requestContext";

export const dynamic = "force-dynamic";

function configuredKey() {
  return String(process.env.SOLCRAFT_ADMIN_KEY || process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || process.env.ADMIN_KEY || "").trim();
}

function providedKey(req: Request, url: URL) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(req.headers.get("x-solcraft-admin-key") || req.headers.get("x-admin-key") || bearer || url.searchParams.get("key") || "").trim();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = createRequestContext(req, { route: "/api/admin/activity", action: "adminActivity" });
  const expected = configuredKey();
  if (!expected) return jsonError("Admin key is not configured.", { status: 404, reasonCode: "ADMIN_NOT_CONFIGURED" });
  if (providedKey(req, url) !== expected) return jsonError("Unauthorized", { status: 401, reasonCode: "UNAUTHORIZED" });
  const data = queryMeasureActivity({
    playerId: url.searchParams.get("playerId") || url.searchParams.get("uid") || "",
    wallet: url.searchParams.get("wallet") || "",
    action: url.searchParams.get("action") || "",
    kind: url.searchParams.get("kind") || "",
    route: url.searchParams.get("route") || "",
    limit: url.searchParams.get("limit") || 100,
  });
  captureMeasureActivity("admin.activity", ctx, { ok: true, query: "measureActivity", count: data.rows.length }, "admin");
  return jsonOk({ measureActivity: data.rows, summary: data.summary });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const expected = configuredKey();
  if (!expected) return jsonError("Admin key is not configured.", { status: 404, reasonCode: "ADMIN_NOT_CONFIGURED" });
  if (providedKey(req, url) !== expected) return jsonError("Unauthorized", { status: 401, reasonCode: "UNAUTHORIZED" });
  return jsonOk({ summary: measureActivitySummary() });
}
