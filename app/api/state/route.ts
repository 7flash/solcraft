import { auth, ensureWorldTickStarted, snapshot } from "@server/backend";

function readInt(url: URL, key: string, fallback: number) {
  const n = parseInt(url.searchParams.get(key) || String(fallback), 10);
  return Number.isFinite(n) ? n : fallback;
}

function stateError(e: any) {
  const msg = String(e?.message || e || "state failed");
  const malformed = /database disk image is malformed/i.test(msg);
  console.error("[api/state]", e);
  return Response.json({ ok: false, msg: malformed ? "database disk image is malformed" : msg, reasonCode: malformed ? "DB_MALFORMED" : "STATE_FAILED" }, { status: malformed ? 503 : 500, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pid = readInt(url, "pid", 0);
    const secret = url.searchParams.get("secret") || "";
    const p = auth(pid, secret);
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: { "Cache-Control": "no-store" } });

    try { ensureWorldTickStarted(); } catch {}

    const q = {
      rev: readInt(url, "rev", 0) || 0,
      ax: readInt(url, "ax", 1000000),
      az: readInt(url, "az", 1000000),
      chat: readInt(url, "chat", 0) || 0,
      mapRev: readInt(url, "mapRev", -1),
    };
    return Response.json({ ok: true, snap: snapshot(p, q) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return stateError(e);
  }
}
