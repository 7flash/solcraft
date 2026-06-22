import { runtimeConfigAllowedKeys, runtimeConfigGet, runtimeConfigList, runtimeConfigSet } from "@server/runtimeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredKey() { return String(process.env.SOLCRAFT_ADMIN_KEY || process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || process.env.ADMIN_KEY || "").trim(); }
function providedKey(req: Request, url: URL) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(req.headers.get("x-solcraft-admin-key") || req.headers.get("x-admin-key") || bearer || url.searchParams.get("key") || "").trim();
}
function fail(msg: string, status = 400, reasonCode = "BAD_REQUEST") { return Response.json({ ok: false, msg, reasonCode }, { status, headers: { "Cache-Control": "no-store" } }); }
function actor(req: Request) { return String(req.headers.get("x-admin-user") || "admin").slice(0, 80); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = configuredKey();
  if (!expected) return fail("Admin key is not configured.", 404, "ADMIN_NOT_CONFIGURED");
  if (providedKey(req, url) !== expected) return fail("Unauthorized", 401, "UNAUTHORIZED");
  const name = url.searchParams.get("name") || "";
  return Response.json({ ok: true, allowed: runtimeConfigAllowedKeys(), config: name ? runtimeConfigGet(name, null) : runtimeConfigList() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const expected = configuredKey();
  if (!expected) return fail("Admin key is not configured.", 404, "ADMIN_NOT_CONFIGURED");
  if (providedKey(req, url) !== expected) return fail("Unauthorized", 401, "UNAUTHORIZED");
  const body: any = await req.json().catch(() => ({}));
  try {
    const saved = runtimeConfigSet(String(body.name || body.key || ""), body.value, actor(req));
    return Response.json({ ok: true, saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return fail(String(e?.message || "Could not save runtime config."), 400, e?.reasonCode || "CONFIG_SAVE_FAILED");
  }
}
