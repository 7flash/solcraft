import { activeBackendName, auth } from "./backend";
import { jsonError, noStoreHeaders, playerIdFrom, readJsonLimited, secretFrom } from "./apiGuard";
import { createRequestContext, withRequestContext } from "./requestContext";
import { measureConsoleError } from "./measureActivity";

export type PlayerApiContext = {
  req: Request;
  body: Record<string, any>;
  player: any;
  ctx: any;
  action: string;
};

export async function readApiBody(req: Request, maxBytes = 64_000): Promise<Record<string, any>> {
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  return await readJsonLimited(req, maxBytes);
}

export async function withPlayerApiRoute(
  req: Request,
  options: { route: string; bodyLimit?: number; defaultAction?: string },
  handler: (ctx: PlayerApiContext) => Promise<Response> | Response,
) {
  let body: Record<string, any> = {};
  let reasonCode = "";
  let ctx = createRequestContext(req, { route: options.route, backend: activeBackendName() });

  try {
    body = await readApiBody(req, options.bodyLimit || 64_000);
    const action = String(body.action || body.type || options.defaultAction || "").slice(0, 48);
    const playerId = playerIdFrom(req, body.pid || body.playerId || 0);
    ctx = withRequestContext(ctx, { playerId, action });

    const player = auth(playerId, String(secretFrom(req, body.secret || "")));
    if (!player) {
      reasonCode = "AUTH";
      return Response.json({ ok: false, msg: "auth", reasonCode }, { status: 401, headers: noStoreHeaders() });
    }

    ctx = withRequestContext(ctx, { playerId: player.id, wallet: player.wallet || "", action });
    return await handler({ req, body, player, ctx, action });
  } catch (e: any) {
    reasonCode = e?.reasonCode || "API_FAILED";
    measureConsoleError(`${options.route}.failed`, ctx, e, { reasonCode });
    return jsonError(e?.message || "Request failed.", { status: e?.status || 500, reasonCode });
  }
}
