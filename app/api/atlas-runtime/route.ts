// @ts-nocheck
import { createMeasure } from "measure-fn";
import { metaGet } from "../../../game/db";
import { atlasEntries, atlasRuntimeDefaults } from "../../../game/atlasCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runtimeMeasure = createMeasure("api.atlas-runtime");

const META_PUBLISHED = "solcraft:atlas:publishedByAtlas:v3";
const META_BOUNDS = "solcraft:atlas:boundsByAtlas:v3";
const META_PADS = "solcraft:atlas:padByAtlas:v3";
const META_MODES = "solcraft:atlas:modes:v3";
const META_RUNTIME_CACHE = "solcraft:atlas:runtimeCacheBust:v3";

function safeJson<T>(raw: string, fallback: T): T { try { return JSON.parse(raw || "") as T; } catch { return fallback; } }
function runtimeUrl(atlas: string, v: string | number = Date.now()) {
  return `/api/atlas-runtime/${encodeURIComponent(String(atlas))}?v=${encodeURIComponent(String(v))}`;
}
function defaultBounds(id: string) {
  const entry = atlasEntries().find((a) => a.id === id);
  return { x0: 0, y0: 0, x1: Math.max(1, Number(entry?.cols || 4)) * 256, y1: Math.max(1, Number(entry?.rows || 4)) * 256 };
}

export async function GET() {
  return runtimeMeasure.measure.root({ start: () => "GET atlas runtime manifest", end: (res: Response) => ({ status: res.status }), budget: 80, maxResultLength: 120 }, async () => {
    const publishedByAtlas = safeJson<Record<string, any>>(metaGet(META_PUBLISHED, "{}"), {});
    const boundsByAtlas = safeJson<Record<string, any>>(metaGet(META_BOUNDS, "{}"), {});
    const padByAtlas = safeJson<Record<string, number>>(metaGet(META_PADS, "{}"), {});
    const cacheByAtlas = safeJson<Record<string, number>>(metaGet(META_RUNTIME_CACHE, "{}"), {});
    const modesByAtlas = safeJson<Record<string, string>>(metaGet(META_MODES, "{}"), atlasRuntimeDefaults());

    const atlases: Record<string, any> = {};
    for (const def of atlasEntries()) {
      const id = def.id;
      const pub = publishedByAtlas[id] || {};
      const version = cacheByAtlas[id] || pub.runtimeCacheBust || pub.createdAt || pub.id || pub.versionId || pub.url || Date.now();
      atlases[id] = {
        id,
        label: def.label,
        cells: def.cells,
        cols: def.cols,
        rows: def.rows,
        url: runtimeUrl(id, version),
        sourceUrl: pub.url || "",
        fileName: pub.fileName || def.runtimeFile,
        version,
        versionId: pub.id || pub.versionId || "",
        bounds: boundsByAtlas[id] || defaultBounds(id),
        pad: Number(padByAtlas[id] || 0) || 0,
        mode: modesByAtlas[id] || def.defaultMode,
        published: !!(pub.url || pub.id || pub.fileName),
        slots: def.slots,
      };
    }

    return Response.json({ ok: true, atlases, runtime: atlases, publishedByAtlas, boundsByAtlas, padByAtlas, modesByAtlas, runtimeCacheBustByAtlas: cacheByAtlas, generatedAt: Date.now() }, {
      headers: { "Cache-Control": "no-store" },
    });
  });
}
