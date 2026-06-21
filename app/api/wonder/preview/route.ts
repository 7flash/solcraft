// @ts-nocheck
import { auth } from "@server/engine";
import { cleanWonderPrompt, applyWonderDesignOptions, normalizeWonderFootprint, normalizeWonderMode, normalizeWonderPaletteId, wonderPaletteColors } from "@server/wonderRecipe";
import { generateWonderRecipe, wonderAiProviderStatus } from "@server/wonderAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const p = auth(Number(body.pid || 0), String(body.secret || ""));
  if (!p) return Response.json({ ok: false, msg: "auth", reasonCode: "AUTH" }, { status: 401 });

  const prompt = cleanWonderPrompt(body.prompt);
  if (!prompt) return Response.json({ ok: false, msg: "Describe your World Wonder first.", reasonCode: "PROMPT_REQUIRED" }, { status: 400 });

  try {
    const footprint = normalizeWonderFootprint(body.footprint || body.size);
    const mode = normalizeWonderMode(body.mode);
    const paletteId = normalizeWonderPaletteId(body.paletteId);
    const palette = wonderPaletteColors(paletteId);
    const kind = `${String(body.kind || "World Wonder")} · ${footprint}x${footprint} · ${mode === "single" ? "one big central landmark" : "multi-tile district/campus"} · palette ${palette.join(",")}`;
    const result = await generateWonderRecipe(prompt, kind);
    const recipe = applyWonderDesignOptions(result.recipe, { prompt, name: body.name, footprint, mode, paletteId, palette });
    return Response.json({ ok: true, recipe, source: result.source, fallback: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return Response.json({ ok: false, reasonCode: "AI_UNAVAILABLE", msg: String(e?.message || "Real AI generation failed."), ai: wonderAiProviderStatus() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
