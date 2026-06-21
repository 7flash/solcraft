// @ts-nocheck
import { cleanWonderPrompt, applyWonderDesignOptions, normalizeWonderFootprint, normalizeWonderMode, normalizeWonderPaletteId, wonderPaletteColors } from "@server/wonderRecipe";
import { generateWonderRecipe, wonderAiProviderStatus } from "@server/wonderAi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredKey() {
  return String(process.env.SOLCRAFT_ADMIN_KEY || process.env.ADMIN_KEY || process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || "").trim();
}
function providedKey(req: Request, url: URL, body: any = {}) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(req.headers.get("x-solcraft-admin-key") || req.headers.get("x-admin-key") || bearer || url.searchParams.get("key") || body?.adminKey || body?.key || "").trim();
}
function assertAdmin(req: Request, url: URL, body: any = {}) {
  const expected = configuredKey();
  if (expected && providedKey(req, url, body) !== expected) {
    return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg: "Admin key required for AI Building Lab." }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const blocked = assertAdmin(req, url, {});
  if (blocked) return blocked;
  const ai = wonderAiProviderStatus();
  return Response.json({ ok: true, ai, msg: ai.configured ? `Real AI provider ready: ${ai.provider}${ai.model ? ` / ${ai.model}` : ""}.` : "Real AI is not configured. Set OPENAI_API_KEY or SOLCRAFT_WONDER_AI_URL and restart Next.js." }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const blocked = assertAdmin(req, url, body);
  if (blocked) return blocked;

  const prompt = cleanWonderPrompt(body.prompt);
  if (!prompt) return Response.json({ ok: false, msg: "Describe a building first.", reasonCode: "PROMPT_REQUIRED" }, { status: 400 });

  try {
    const footprint = normalizeWonderFootprint(body.footprint || body.size || 5);
    const mode = normalizeWonderMode(body.mode || "single");
    const paletteId = normalizeWonderPaletteId(body.paletteId || "solar");
    const palette = wonderPaletteColors(paletteId);
    const kind = `${String(body.kind || "test building")} · ${footprint}x${footprint} · ${mode} · palette ${palette.join(",")}`;
    const result = await generateWonderRecipe(prompt, kind);
    const recipe = applyWonderDesignOptions(result.recipe, { prompt, name: body.name, footprint, mode, paletteId, palette });
    return Response.json({ ok: true, recipe, source: result.source, fallback: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return Response.json({ ok: false, reasonCode: "AI_UNAVAILABLE", msg: String(e?.message || "Real AI generation failed."), ai: wonderAiProviderStatus() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
