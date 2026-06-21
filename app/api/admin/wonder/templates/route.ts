// @ts-nocheck
import { buildWonderTemplateRecipe, listWonderTemplates } from "@server/wonderTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredKey() {
  return String(process.env.SOLCRAFT_ADMIN_KEY || process.env.ADMIN_KEY || process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || "").trim();
}
function providedKey(req: Request, url: URL, body: any = {}) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(req.headers.get("x-solcraft-admin-key") || req.headers.get("x-admin-key") || bearer || url.searchParams.get("key") || body?.adminKey || body?.key || "").trim();
}
function assertAdmin(req: Request, url: URL, body: any = {}) {
  const expected = configuredKey();
  if (expected && providedKey(req, url, body) !== expected) {
    return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg: "Admin key required for Wonder Template Lab." }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const blocked = assertAdmin(req, url, {});
  if (blocked) return blocked;
  return Response.json({ ok: true, templates: listWonderTemplates() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const blocked = assertAdmin(req, url, body);
  if (blocked) return blocked;
  const recipe = buildWonderTemplateRecipe(body.templateId || body.id || "school", body);
  return Response.json({ ok: true, recipe, templates: listWonderTemplates(), source: "template" }, { headers: { "Cache-Control": "no-store" } });
}
