// @ts-nocheck
import { auth } from "@server/backend";
import { cleanWonderPrompt, applyWonderDesignOptions, normalizeWonderFootprint, normalizeWonderMode, normalizeWonderPaletteId, wonderPaletteColors } from "@server/wonderRecipe";
import { generateWonderRecipe, wonderAiProviderStatus } from "@server/wonderAi";
import { jsonError, noStoreHeaders, playerIdFrom, readJsonLimited, secretFrom } from "@server/apiGuard";
import { checkRateLimit, rateLimitHeaders } from "@server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any = {};
  try { body = await readJsonLimited(req, 48_000); }
  catch (e: any) { return jsonError(e?.message || "Bad request body.", { status: e?.status || 400, reasonCode: e?.reasonCode || "BAD_JSON" }); }

  const p = auth(playerIdFrom(req, body.pid), String(secretFrom(req, body.secret || "")));
  if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401, headers: noStoreHeaders() });

  const limit = checkRateLimit(`wonder-preview:${p.id}`, { capacity: 3, refillPerSec: 1 / 30, cost: 1 });
  if (!limit.ok) return jsonError("Wonder previews are cooling down. Try again in a moment.", { status: 429, reasonCode: "RATE_LIMITED", headers: rateLimitHeaders(limit) });

  const prompt = cleanWonderPrompt(body.prompt);
  if (!prompt) return Response.json({ ok: false, msg: "Describe your World Wonder first.", reasonCode: "PROMPT_REQUIRED" }, { status: 400, headers: noStoreHeaders() });

  try {
    const footprint = normalizeWonderFootprint(body.footprint || body.size);
    const mode = normalizeWonderMode(body.mode);
    const paletteId = normalizeWonderPaletteId(body.paletteId);
    const palette = wonderPaletteColors(paletteId);
    const kind = `${String(body.kind || "World Wonder").slice(0, 48)} · ${footprint}x${footprint} · ${mode === "single" ? "one big central landmark" : "multi-tile district/campus"} · palette ${palette.join(",")}`;
    const result = await generateWonderRecipe(prompt, kind);
    const recipe = applyWonderDesignOptions(result.recipe, { prompt, name: body.name, footprint, mode, paletteId, palette });
    return Response.json({ ok: true, recipe, source: result.source, fallback: false }, { headers: noStoreHeaders() });
  } catch (e: any) {
    return Response.json({ ok: false, reasonCode: "AI_UNAVAILABLE", msg: String(e?.message || "Real AI generation failed."), ai: wonderAiProviderStatus() }, { status: 503, headers: noStoreHeaders() });
  }
}
