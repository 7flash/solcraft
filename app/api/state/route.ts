import { auth, ensureWorldTickStarted, snapshot } from "@server/engine";
import { intParam, noStoreHeaders, playerIdFrom, secretFrom } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";

export const dynamic = "force-dynamic";

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
    headers: noStoreHeaders(),
  });
}

export async function GET(req: Request) {
  ensureWorldTickStarted();
  try {
    const url = new URL(req.url);
    const pid = playerIdFrom(req, url.searchParams.get("pid") || 0);
    const secret = secretFrom(req, url.searchParams.get("secret") || "");
    const p = auth(pid, secret);
    if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: noStoreHeaders() });

    const limit = checkRateLimit(`state:${p.id}`, { capacity: 12, refillPerSec: 4, cost: 1 });
    if (!limit.ok) return Response.json({ ok: false, msg: "State polling is too frequent.", reasonCode: "RATE_LIMITED" }, { status: 429, headers: noStoreHeaders(rateLimitHeaders(limit)) });

    const q = {
      rev: intParam(url, "rev", 0, 0, 2_147_483_647) || 0,
      ax: intParam(url, "ax", 1000000),
      az: intParam(url, "az", 1000000),
      chat: intParam(url, "chat", 0, 0, 2_147_483_647) || 0,
      mapRev: intParam(url, "mapRev", -1, -1, 2_147_483_647),
    };
    return Response.json({ ok: true, snap: snapshot(p, q) }, { headers: noStoreHeaders() });
  } catch (e: any) {
    return stateError(e);
  }
}
