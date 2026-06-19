// @ts-nocheck
import { createMeasure } from "measure-fn";
import {
  addBombsToPlayer,
  applyPlayerPreset,
  applyPlayerValues,
  clampInt,
  displayPlayerResources,
  healAndRefillPlayer,
  playerById,
  playerResourcesResponse,
  requireAdminKey,
} from "../../../../game/mechanics/playerResources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const measure = createMeasure("api.admin.player-resources", { maxResultLength: 220 });

async function readBody(req: Request) {
  if (req.method === "GET") return {};
  return await req.json().catch(() => ({}));
}

function errorResponse(e: any) {
  return Response.json(
    { ok: false, msg: e?.message || "admin resources failed", reasonCode: e?.reasonCode || "ADMIN_RESOURCES_FAILED" },
    { status: e?.status || 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return measure.measure.root({ start: () => "GET player resources", end: (r: Response) => ({ status: r.status }), budget: 160 }, async () => {
    try {
      requireAdminKey(req, url, {});
      return playerResourcesResponse({ generatedAt: Date.now() });
    } catch (e: any) {
      return errorResponse(e);
    }
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await readBody(req);
  return measure.measure.root({ start: () => `POST player resources ${String(body?.action || "?")}`, end: (r: Response) => ({ status: r.status }), budget: 200 }, async () => {
    try {
      requireAdminKey(req, url, body);
      const action = String(body.action || "grant");
      const p = playerById(body.playerId || body.pid);
      let note = "Updated player.";

      if (action === "grant" || action === "set") {
        const changed = applyPlayerValues(p, action as any, body.values || {});
        note = `${action === "set" ? "Set" : "Granted"} ${Object.keys(changed).join(", ") || "nothing"} for ${p.name}.`;
      } else if (action === "quick") {
        const preset = String(body.preset || "starter");
        const changed = applyPlayerPreset(p, preset);
        note = `Applied ${preset} preset to ${p.name}: ${Object.keys(changed).join(", ")}.`;
      } else if (action === "addBombs") {
        const added = addBombsToPlayer(p, String(body.variant || "popper"), clampInt(body.count || 1, 1, 50));
        note = `Added ${added} ${String(body.variant || "popper")} bomb(s) to ${p.name}.`;
      } else if (action === "heal") {
        healAndRefillPlayer(p);
        note = `Healed and refilled ${p.name}.`;
      } else {
        return Response.json({ ok: false, msg: "Unknown player resource action", reasonCode: "UNKNOWN_ACTION" }, { status: 400 });
      }

      return playerResourcesResponse({ note, player: displayPlayerResources(playerById(p.id)) });
    } catch (e: any) {
      return errorResponse(e);
    }
  });
}
