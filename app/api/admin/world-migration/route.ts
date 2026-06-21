// @ts-nocheck
import { forceClientRefresh } from "@server/engine";
import { requireAdminKey } from "@server/mechanics/playerResources";
import { importWorldExport, makeWorldExport, worldSyncSummary } from "@server/worldSync";
import { applyCapitalMigration, planCapitalMigration } from "@server/worldMigration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLocal(req: Request) {
  const h = new URL(req.url).hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || process.env.NODE_ENV !== "production";
}
function migrationAllowed(req: Request) { return isLocal(req) || process.env.SOLCRAFT_ALLOW_WORLD_MIGRATION === "1"; }
function fail(e: any) {
  return Response.json({ ok: false, msg: e?.message || "World migration failed", reasonCode: e?.reasonCode || "WORLD_MIGRATION_FAILED" }, { status: e?.status || 500, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    requireAdminKey(req, url, {});
    return Response.json({ ok: true, ...worldSyncSummary("world"), migrationAllowed: migrationAllowed(req) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e:any) { return fail(e); }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  try {
    requireAdminKey(req, url, body);
    const action = String(body.action || "plan");
    if (!migrationAllowed(req)) throw Object.assign(new Error("World migration is disabled on this server. Run on localhost or set SOLCRAFT_ALLOW_WORLD_MIGRATION=1 during maintenance."), { status: 403, reasonCode: "MIGRATION_DISABLED" });
    const snapshot = body.snapshot?.tables ? body.snapshot : makeWorldExport("world");
    const plan = planCapitalMigration(snapshot, body.options || {});
    if (action === "plan") return Response.json({ ok: true, plan }, { headers: { "Cache-Control": "no-store" } });
    if (action === "preview") {
      const migrated = applyCapitalMigration(snapshot, plan);
      return Response.json({ ok: true, plan, migrated: { kind: migrated.kind, generatedAt: migrated.generatedAt, counts: migrated.counts, players: (migrated.players || []).slice(0, 12) } }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "apply") {
      if (String(body.confirm || "") !== "MIGRATE") throw Object.assign(new Error("Type MIGRATE to apply the ordered capital migration."), { status: 400, reasonCode: "CONFIRM_REQUIRED" });
      const migrated = applyCapitalMigration(snapshot, plan);
      const result = importWorldExport(migrated, { scope: "world", replace: true });
      forceClientRefresh("World was migrated to the capital layout. Refresh to load the ordered map.");
      return Response.json({ ok: true, plan, result }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ ok: false, msg: "Unknown world migration action", reasonCode: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (e:any) { return fail(e); }
}
