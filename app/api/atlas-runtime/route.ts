// @ts-nocheck
import { createMeasure } from "measure-fn";
import { metaGet } from "../../../game/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runtimeMeasure = createMeasure("api.atlas-runtime");

const ATLAS = {
  terrain: { label: "Terrain", cells: 4, cols: 4, rows: 4, runtimeFile: "terrain_atlas_clean.png" },
  building: { label: "Building", cells: 4, cols: 4, rows: 4, runtimeFile: "building_atlas_clean.png" },
  fx: { label: "FX", cells: 4, cols: 4, rows: 4, runtimeFile: "fx_atlas_clean.png" },
  ui: { label: "UI", cells: 4, cols: 4, rows: 4, runtimeFile: "ui_atlas_clean.png" },
  doll: { label: "Doll", cells: 8, cols: 8, rows: 6, runtimeFile: "doll_atlas_clean.png" },
};

const META_PUBLISHED = "solcraft:atlas:publishedByAtlas:v3";
const META_BOUNDS = "solcraft:atlas:boundsByAtlas:v3";
const META_PADS = "solcraft:atlas:padByAtlas:v3";
const META_MODES = "solcraft:atlas:modes:v3";
const META_RUNTIME_CACHE = "solcraft:atlas:runtimeCacheBust:v3";

function safeJson<T>(raw: string, fallback: T): T { try { return JSON.parse(raw || "") as T; } catch { return fallback; } }
function runtimeUrl(atlas: keyof typeof ATLAS, v: string | number = Date.now()) {
  return `/api/atlas-runtime/${encodeURIComponent(String(atlas))}?v=${encodeURIComponent(String(v))}`;
}

export async function GET() {
  return runtimeMeasure.measure.root({ start: () => "GET atlas runtime manifest", end: (res: Response) => ({ status: res.status }), budget: 80, maxResultLength: 120 }, async () => {
    const publishedByAtlas = safeJson<Record<string, any>>(metaGet(META_PUBLISHED, "{}"), {});
    const boundsByAtlas = safeJson<Record<string, any>>(metaGet(META_BOUNDS, "{}"), {});
    const padByAtlas = safeJson<Record<string, number>>(metaGet(META_PADS, "{}"), {});
    const cacheByAtlas = safeJson<Record<string, number>>(metaGet(META_RUNTIME_CACHE, "{}"), {});
    const modesByAtlas = safeJson<Record<string, string>>(metaGet(META_MODES, "{}"), {
      terrain: "procedural",
      building: "atlas",
      fx: "atlas",
      ui: "atlas",
      doll: "atlas",
    });

    const atlases: Record<string, any> = {};
    for (const [id, def] of Object.entries(ATLAS)) {
      const pub = publishedByAtlas[id] || {};
      const version = cacheByAtlas[id] || pub.runtimeCacheBust || pub.createdAt || pub.id || pub.versionId || pub.url || Date.now();
      atlases[id] = {
        id,
        label: def.label,
        cells: def.cells,
        cols: def.cols || def.cells,
        rows: def.rows || def.cells,
        url: runtimeUrl(id as keyof typeof ATLAS, version),
        sourceUrl: pub.url || "",
        fileName: pub.fileName || def.runtimeFile,
        version,
        versionId: pub.id || pub.versionId || "",
        bounds: boundsByAtlas[id] || { x0: 0, y0: 0, x1: 1024, y1: id === "doll" ? 768 : 1024 },
        pad: Number(padByAtlas[id] || 0) || 0,
        mode: modesByAtlas[id] || (id === "terrain" ? "procedural" : "atlas"),
        published: !!(pub.url || pub.id || pub.fileName),
      };
    }

    return Response.json({ ok: true, atlases, runtime: atlases, publishedByAtlas, boundsByAtlas, padByAtlas, modesByAtlas, runtimeCacheBustByAtlas: cacheByAtlas, generatedAt: Date.now() }, {
      headers: { "Cache-Control": "no-store" },
    });
  });
}