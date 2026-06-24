import { auth, ensureWorldTickStarted, snapshot } from "@server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

function readIntFrom(value: unknown, fallback: number) {
  const n = parseInt(String(value ?? fallback), 10);
  return Number.isFinite(n) ? n : fallback;
}

function bearerSecret(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
}

async function readBody(req: Request) {
  if (req.method === "GET") return {};
  const raw = await req.text().catch(() => "");
  if (!raw) return {};
  if (raw.length > 64_000) throw Object.assign(new Error("State request body is too large."), { status: 413, reasonCode: "BODY_TOO_LARGE" });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Bad request body."), { status: 400, reasonCode: "BAD_JSON" }); }
}

function readParams(req: Request, body: any) {
  const url = new URL(req.url);
  const headerPid = req.headers.get("x-solcraft-player") || req.headers.get("x-player-id") || "";
  const headerSecret = req.headers.get("x-solcraft-secret") || req.headers.get("x-player-secret") || bearerSecret(req) || "";

  // GET query support remains only for older clients. New clients use POST or
  // headers so the player secret is not written to access/proxy/referrer logs.
  const pid = readIntFrom(body?.pid ?? body?.playerId ?? headerPid ?? url.searchParams.get("pid"), 0);
  const secret = String(body?.secret || headerSecret || url.searchParams.get("secret") || "");

  return {
    pid,
    secret,
    q: {
      rev: readIntFrom(body?.rev ?? url.searchParams.get("rev"), 0) || 0,
      ax: readIntFrom(body?.ax ?? url.searchParams.get("ax"), 1000000),
      az: readIntFrom(body?.az ?? url.searchParams.get("az"), 1000000),
      chat: readIntFrom(body?.chat ?? url.searchParams.get("chat"), 0) || 0,
      mapRev: readIntFrom(body?.mapRev ?? url.searchParams.get("mapRev"), -1),
    },
  };
}

function stateError(e: any) {
  const msg = String(e?.message || e || "state failed");
  const malformed = /database disk image is malformed/i.test(msg);
  const status = Number(e?.status || (malformed ? 503 : 500));
  const reasonCode = String(e?.reasonCode || (malformed ? "DB_MALFORMED" : "STATE_FAILED"));
  console.error("[api/state]", e);
  return Response.json({ ok: false, msg: malformed ? "database disk image is malformed" : msg, reasonCode }, { status, headers: noStoreHeaders() });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  try {
    const body = await readBody(req);
    const { pid, secret, q } = readParams(req, body);
    const p = auth(pid, secret);
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: noStoreHeaders() });

    try { ensureWorldTickStarted(); } catch {}

    return Response.json({ ok: true, snap: snapshot(p, q) }, { headers: noStoreHeaders() });
  } catch (e: any) {
    return stateError(e);
  }
}
