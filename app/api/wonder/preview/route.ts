// @ts-nocheck
import { createMeasure } from "measure-fn";
import { activeBackendName, auth } from "@server/backend";
import { cleanWonderPrompt, applyWonderDesignOptions, normalizeWonderFootprint, normalizeWonderMode, normalizeWonderPaletteId, wonderPaletteColors } from "@server/wonderRecipe";
import { generateWonderRecipe, wonderAiProviderStatus } from "@server/wonderAi";
import { jsonError, noStoreHeaders, playerIdFrom, readJsonLimited, secretFrom } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";
import { createRequestContext, withRequestContext } from "@server/requestContext";
import { responseMeasureFields } from "@server/measureFields";
import { captureMeasureActivity, measureConsoleError } from "@server/measureActivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const httpMeasure = createMeasure("api.wonder.preview", { maxResultLength: 120 });

export async function POST(req: Request) {
  let body: any = {};
  let ctx = createRequestContext(req, { route: "/api/wonder/preview", backend: activeBackendName(), action: "wonderPreview" });
  let reasonCode = "";
  return httpMeasure.measure.root({
    start: () => `POST /api/wonder/preview uid=${ctx.playerId || 0}`,
    end: (res: Response) => responseMeasureFields(res, ctx, { reason: reasonCode }),
    budget: 26000,
    maxResultLength: 120,
  }, async () => {
    try { body = await readJsonLimited(req, 48_000); }
    catch (e: any) { reasonCode = e?.reasonCode || "BAD_JSON"; return jsonError(e?.message || "Bad request body.", { status: e?.status || 400, reasonCode }); }

    const p = auth(playerIdFrom(req, body.pid), String(secretFrom(req, body.secret || "")));
    if (!p) { reasonCode = "AUTH"; return Response.json({ ok: false, msg: "auth", reasonCode }, { status: 401, headers: noStoreHeaders() }); }
    ctx = withRequestContext(ctx, { playerId: p.id, wallet: p.wallet || "" });

    const limit = checkRateLimit(`wonder-preview:${p.id}`, { capacity: 3, refillPerSec: 1 / 30, cost: 1 });
    if (!limit.ok) { reasonCode = "RATE_LIMITED"; return jsonError("Wonder previews are cooling down. Try again in a moment.", { status: 429, reasonCode, headers: rateLimitHeaders(limit) }); }

    const prompt = cleanWonderPrompt(body.prompt);
    if (!prompt) { reasonCode = "PROMPT_REQUIRED"; return Response.json({ ok: false, msg: "Describe your World Wonder first.", reasonCode }, { status: 400, headers: noStoreHeaders() }); }

    try {
      const footprint = normalizeWonderFootprint(body.footprint || body.size);
      const mode = normalizeWonderMode(body.mode);
      const paletteId = normalizeWonderPaletteId(body.paletteId);
      const palette = wonderPaletteColors(paletteId);
      const kind = `${String(body.kind || "World Wonder").slice(0, 48)} · ${footprint}x${footprint} · ${mode === "single" ? "one big central landmark" : "multi-tile district/campus"} · palette ${palette.join(",")}`;
      const result = await generateWonderRecipe(prompt, kind);
      const recipe = applyWonderDesignOptions(result.recipe, { prompt, name: body.name, footprint, mode, paletteId, palette });
      captureMeasureActivity("wonder.preview", ctx, { ok: true, source: result.source, footprint, mode }, "wonder");
      return Response.json({ ok: true, recipe, source: result.source, fallback: false }, { headers: noStoreHeaders() });
    } catch (e: any) {
      reasonCode = "AI_UNAVAILABLE";
      measureConsoleError("api.wonder.preview.failed", ctx, e, { reasonCode });
      return Response.json({ ok: false, reasonCode, msg: String(e?.message || "Real AI generation failed."), ai: wonderAiProviderStatus() }, { status: 503, headers: noStoreHeaders() });
    }
  });
}
