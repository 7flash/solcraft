export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readInt(url: URL, key: string, fallback: number) {
  const n = parseInt(url.searchParams.get(key) || String(fallback), 10);
  return Number.isFinite(n) ? n : fallback;
}

function stateError(e: any) {
  const message = String(e?.message || e || "state failed");
  const malformed = /database disk image is malformed/i.test(message);
  console.error("[api/state]", e);
  return Response.json({
    ok: false,
    msg: malformed ? "database disk image is malformed" : "state failed",
    reasonCode: malformed ? "DB_MALFORMED" : "STATE_FAILED",
  }, {
    status: malformed ? 503 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pid = readInt(url, "pid", 0);
    const rev = readInt(url, "rev", 0) || 0;
    const mapRev = readInt(url, "mapRev", -1);
    const secret = url.searchParams.get("secret") || "";

    // Dynamic import avoids production route-loader TDZ issues and lets this
    // endpoint return a clear JSON error if the DB layer itself fails to load.
    const { auth, snapshot } = await import("../../../game/engine");
    const p = auth(pid, secret);
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: { "Cache-Control": "no-store" } });

    const q = {
      rev,
      ax: readInt(url, "ax", 1000000),
      az: readInt(url, "az", 1000000),
      chat: readInt(url, "chat", 0) || 0,
      mapRev,
    };
    return Response.json({ ok: true, snap: snapshot(p, q) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return stateError(e);
  }
}
