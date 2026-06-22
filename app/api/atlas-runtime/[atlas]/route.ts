// @ts-nocheck
import { promises as fs } from "fs";
import path from "path";
import { createMeasure } from "measure-fn";
import { metaGet } from "../../../../game/db";
import { atlasEntry } from "../../../../game/atlasCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runtimeImageMeasure = createMeasure("api.atlas-runtime.image");
const META_PUBLISHED = "solcraft:atlas:publishedByAtlas:v3";

function safeJson<T>(raw: string, fallback: T): T { try { return JSON.parse(raw || "") as T; } catch { return fallback; } }
function publicDir() { return path.join(process.cwd(), "public", "assets", "solcraft"); }
function appFilesDir() { return path.join(process.cwd(), "app", "assets", "solcraft", "_files"); }
function versionDir(atlas: string) { return path.join(publicDir(), "atlas-versions", atlas); }
async function exists(p: string) { try { await fs.access(p); return true; } catch { return false; } }
function cleanFileName(value: any) { return String(value || "").replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+/, "").slice(0, 180); }
async function firstExisting(paths: string[]) { for (const p of paths) if (p && await exists(p)) return p; return ""; }

function fallbackAtlasSvg(atlas: string, cols: number, rows: number) {
  const w = 1024;
  const h = Math.round((1024 / Math.max(1, cols)) * Math.max(1, rows));
  const cells: string[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const fill = duskAtlasFallbackCell(atlas, x, y);
    cells.push(`<rect x="${x * w / cols}" y="${y * h / rows}" width="${w / cols}" height="${h / rows}" fill="${fill}"/><text x="${(x + .5) * w / cols}" y="${(y + .52) * h / rows}" text-anchor="middle" dominant-baseline="middle" font-size="34" fill="${DUSK_ATLAS_TEXT}" font-family="system-ui, sans-serif">${x + y * cols}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${DUSK_ATLAS_BG}"/>${cells.join("")}</svg>`;
}

export async function GET(req: Request, ctx: any) {
  const atlas = String(ctx?.params?.atlas || "").toLowerCase();
  return runtimeImageMeasure.measure.root({ start: () => `GET runtime image ${atlas}`, end: (res: Response) => ({ status: res.status, atlas }), budget: 160, maxResultLength: 120 }, async () => {
    const def = atlasEntry(atlas);
    if (!def) return new Response("Unknown atlas", { status: 404, headers: { "Cache-Control": "no-store" } });
    const published = safeJson<Record<string, any>>(metaGet(META_PUBLISHED, "{}"), {});
    const pub = published[atlas] || {};
    const fileName = cleanFileName(pub.fileName || "");
    const id = cleanFileName(pub.id || pub.versionId || "").replace(/\.png$/i, "");
    const runtimeFile = def.runtimeFile;

    const candidates = [
      pub.filePath || "",
      fileName ? path.join(versionDir(atlas), fileName) : "",
      id ? path.join(versionDir(atlas), `${id}.png`) : "",
      fileName ? path.join(appFilesDir(), "atlas-versions", atlas, fileName) : "",
      id ? path.join(appFilesDir(), "atlas-versions", atlas, `${id}.png`) : "",
      path.join(publicDir(), runtimeFile),
      path.join(appFilesDir(), runtimeFile),
    ].filter(Boolean);
    const source = await firstExisting(candidates);
    if (source) {
      const body = await fs.readFile(source);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          "X-SolCraft-Atlas": atlas,
          "X-SolCraft-Atlas-Source": path.basename(source),
          "X-SolCraft-Atlas-Version": String(pub.id || pub.versionId || pub.createdAt || "runtime"),
        },
      });
    }

    return new Response(fallbackAtlasSvg(atlas, def.cols, def.rows), {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-SolCraft-Atlas-Fallback": atlas },
    });
  });
}