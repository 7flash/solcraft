// @ts-nocheck
import { createMeasure } from "measure-fn";
import { forceClientRefresh } from "@server/engine";
import {
  adminImpersonationPayload,
  importWorldExport,
  localWorldPlayers,
  makeWorldExport,
  worldSyncSummary,
} from "@server/worldSync";
import { requireAdminKey } from "@server/mechanics/playerResources";
import { assertCompatibleWorldSyncSnapshot, normalizeWorldSyncSnapshot } from "@server/worldSyncCompat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const measure = createMeasure("api.admin.world-sync", { maxResultLength: 300 });

async function body(req: Request) { return await req.json().catch(() => ({})); }
function isLocal(req: Request) {
  const h = new URL(req.url).hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || process.env.NODE_ENV !== "production";
}
function importAllowed(req: Request) { return isLocal(req) || process.env.SOLCRAFT_ALLOW_WORLD_IMPORT === "1"; }
function impersonateAllowed(req: Request) { return isLocal(req) || process.env.SOLCRAFT_ALLOW_ADMIN_IMPERSONATE === "1"; }
function remoteExportAllowed(req: Request) { return isLocal(req) || process.env.SOLCRAFT_ALLOW_WORLD_REMOTE_EXPORT === "1"; }
function adminKeyFrom(req: Request, url: URL, b: any) {
  return String((b && (b.adminKey || b.key)) || url.searchParams.get("adminKey") || req.headers.get("x-solcraft-admin-key") || "").trim();
}
function normalizeRemoteOrigin(v: any) {
  const raw = String(v || "").trim();
  if (!raw) throw Object.assign(new Error("Enter production origin first."), { status: 400, reasonCode: "REMOTE_ORIGIN_REQUIRED" });
  let u: URL;
  try { u = new URL(raw); } catch { throw Object.assign(new Error("Production origin must be a full URL, like https://solcraft.fun"), { status: 400, reasonCode: "REMOTE_ORIGIN_INVALID" }); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw Object.assign(new Error("Production origin must be http or https."), { status: 400, reasonCode: "REMOTE_ORIGIN_INVALID" });
  return u.origin;
}
function scopeOf(v: any) { return String(v || "world") === "all" ? "all" : "world"; }

async function fetchRemoteWorldExport(originValue: any, scope: any, adminKey: string) {
  const origin = normalizeRemoteOrigin(originValue);
  const q = new URLSearchParams({ action: "export", scope });
  if (adminKey) q.set("adminKey", adminKey);
  const target = `${origin}/api/admin/world-sync?${q.toString()}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Number(process.env.SOLCRAFT_WORLD_SYNC_TIMEOUT_MS || 30000));
  let res: Response;
  try {
    res = await fetch(target, {
      headers: { "x-solcraft-admin-key": adminKey, "accept": "application/json" },
      signal: ac.signal,
      cache: "no-store" as any,
    });
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Production export timed out." : `Could not reach production export route: ${e?.message || String(e)}`;
    throw Object.assign(new Error(msg), { status: 502, reasonCode: "REMOTE_EXPORT_FETCH_FAILED" });
  } finally { clearTimeout(timer); }

  const text = await res.text().catch(() => "");
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok || !json || json.ok === false) {
    const preview = String(json?.msg || text || "").slice(0, 240);
    const hint = res.status === 401 || res.status === 403
      ? " Check the admin key you entered for production."
      : res.status === 404
        ? " Production does not have /api/admin/world-sync deployed yet; use manual JSON import or a local DB snapshot instead."
        : "";
    throw Object.assign(new Error(`Production export failed: HTTP ${res.status}.${hint}${preview ? ` ${preview}` : ""}`), { status: 502, reasonCode: "REMOTE_EXPORT_FAILED" });
  }

  const compat = assertCompatibleWorldSyncSnapshot(json, { scope, source: "remote" });
  return { ok: true, origin, snapshot: compat.snapshot, compat: compat.report };
}

function fail(e: any) {
  return Response.json(
    {
      ok: false,
      msg: e?.message || "World sync failed",
      reasonCode: e?.reasonCode || "WORLD_SYNC_FAILED",
      details: e?.details || null,
    },
    { status: e?.status || 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return measure.measure.root({ start: () => `GET world-sync ${url.searchParams.get("action") || "status"}`, end: (r: Response) => ({ status: r.status }), budget: 260 }, async () => {
    try {
      requireAdminKey(req, url, {});
      const action = String(url.searchParams.get("action") || "status");
      const scope = scopeOf(url.searchParams.get("scope"));
      if (action === "export") {
        return Response.json(makeWorldExport(scope), { headers: { "Cache-Control": "no-store" } });
      }
      return Response.json({
        ...worldSyncSummary(scope),
        players: localWorldPlayers(),
        importAllowed: importAllowed(req),
        impersonateAllowed: impersonateAllowed(req),
        remoteExportAllowed: remoteExportAllowed(req),
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (e: any) { return fail(e); }
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const b = await body(req);
  return measure.measure.root({ start: () => `POST world-sync ${String(b?.action || "?")}`, end: (r: Response) => ({ status: r.status }), budget: 700 }, async () => {
    try {
      requireAdminKey(req, url, b);
      const action = String(b.action || "");
      const scope = scopeOf(b.scope || b.snapshot?.scope);
      if (action === "exportRemote") {
        if (!remoteExportAllowed(req)) throw Object.assign(new Error("Remote production export proxy is local-only unless SOLCRAFT_ALLOW_WORLD_REMOTE_EXPORT=1 is set."), { status: 403, reasonCode: "REMOTE_EXPORT_DISABLED" });
        return Response.json(await fetchRemoteWorldExport(b.origin || b.prodUrl || b.productionOrigin, scope, adminKeyFrom(req, url, b)), { headers: { "Cache-Control": "no-store" } });
      }
      if (action === "validateSnapshot") {
        const compat = normalizeWorldSyncSnapshot(b.snapshot, { scope, source: b.source || "paste" });
        return Response.json({ ok: !!compat.ok, ...compat }, { status: compat.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
      }
      if (action === "import") {
        if (!importAllowed(req)) throw Object.assign(new Error("World import is disabled on this server. Run it on localhost or set SOLCRAFT_ALLOW_WORLD_IMPORT=1."), { status: 403, reasonCode: "IMPORT_DISABLED" });
        const compat = assertCompatibleWorldSyncSnapshot(b.snapshot, { scope, source: b.source || "local" });
        const result = importWorldExport(compat.snapshot, { scope: compat.snapshot.scope, replace: b.replace !== false });
        forceClientRefresh("World snapshot was imported locally. Refresh to load the synced world.");
        return Response.json({ ...result, compat: compat.report, players: localWorldPlayers() }, { headers: { "Cache-Control": "no-store" } });
      }
      if (action === "impersonate") {
        if (!impersonateAllowed(req)) throw Object.assign(new Error("Admin impersonation is local-only unless SOLCRAFT_ALLOW_ADMIN_IMPERSONATE=1 is set."), { status: 403, reasonCode: "IMPERSONATE_DISABLED" });
        return Response.json({ ok: true, auth: adminImpersonationPayload(b.playerId || b.pid) }, { headers: { "Cache-Control": "no-store" } });
      }
      return Response.json({ ok: false, msg: "Unknown world-sync action", reasonCode: "UNKNOWN_ACTION" }, { status: 400 });
    } catch (e: any) { return fail(e); }
  });
}
