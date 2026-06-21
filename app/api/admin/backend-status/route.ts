import { jsonError, jsonOk } from "@server/apiGuard";
import { backendStatus, ensureWorldTickStarted } from "@server/backend";

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
  ensureWorldTickStarted();
  const url = new URL(req.url);
  const expected = configuredKey();
  if (!expected) return jsonError("Admin key is not configured.", { status: 404, reasonCode: "ADMIN_NOT_CONFIGURED" });
  if (providedKey(req, url) !== expected) return jsonError("Unauthorized", { status: 401, reasonCode: "UNAUTHORIZED" });
  return jsonOk({ status: backendStatus() });
}
