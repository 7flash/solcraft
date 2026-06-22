import { createMeasure } from "measure-fn";
import { buildReleaseReadinessReport } from "@server/releaseReadiness";
import { readMeasureActivity } from "@server/measureActivity";
import { metaGet } from "@server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const measure = createMeasure("api.admin.release-gate", { maxResultLength: 160 });

function configuredAdminKey() {
  return String(process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || process.env.SOLCRAFT_ADMIN_KEY || process.env.ADMIN_KEY || "").trim();
}
function providedAdminKey(req: Request, url: URL) {
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
function safeJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw || "") as T; } catch { return fallback; }
}
function readRuntimeConfig() {
  return safeJson<Record<string, unknown>>(metaGet("solcraft:runtimeConfig:v1", "{}"), {});
}
function readSchemaVersion() {
  const raw = metaGet("solcraft:db:schemaVersion", "0");
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = configuredAdminKey();
  const okKey = !!expected && providedAdminKey(req, url) === expected;
  if (!okKey) {
    return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return measure.measure.root({
    start: () => "GET /api/admin/release-gate uid=admin",
    end: (res: Response) => ({ status: res.status, ok: res.ok, route: "/api/admin/release-gate", uid: "admin" }),
    budget: 120,
    maxResultLength: 140,
  }, async () => {
    let backendStatus: unknown = null;
    let worldTickVisible = false;
    try {
      const backend = await import("@server/backend");
      backendStatus = typeof backend.backendStatus === "function" ? backend.backendStatus() : null;
      worldTickVisible = !!backendStatus;
    } catch {
      backendStatus = null;
    }
    const activity = readMeasureActivity({ limit: 1 });
    const report = buildReleaseReadinessReport({
      schemaVersion: readSchemaVersion(),
      expectedSchemaVersion: 40,
      runtimeConfig: readRuntimeConfig(),
      measureActivityCount: activity.total || activity.rows?.length || 0,
      worldTickVisible,
      backendStatus,
    });
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  });
}
