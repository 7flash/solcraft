// @ts-nocheck
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE = /^[a-z0-9_./-]+$/i;
function roots() {
  return [
    path.join(process.cwd(), "public", "assets", "solcraft"),
    path.join(process.cwd(), "app", "assets", "solcraft", "_files"),
  ];
}
async function exists(p: string) { try { await fs.access(p); return true; } catch { return false; } }

const LEGACY_RUNTIME: Record<string, string> = {
  "terrain_atlas_clean.png": "terrain",
  "building_atlas_clean.png": "building",
  "fx_atlas_clean.png": "fx",
  "ui_atlas_clean.png": "ui",
  "doll_atlas_clean.png": "doll",
};

export async function GET(req: Request, ctx: any) {
  const parts = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  const rel = parts.join("/");
  if (!rel || rel.includes("..") || !SAFE.test(rel)) return new Response("Not found", { status: 404 });

  // Compatibility only: old clients/tools may still request the historical
  // filenames. Runtime code should use /api/atlas-runtime/<atlas>, which resolves
  // the currently published atlas from Atlas Studio metadata.
  const legacyAtlas = LEGACY_RUNTIME[rel.split("/").pop() || ""];
  if (legacyAtlas) {
    return Response.redirect(new URL(`/api/atlas-runtime/${legacyAtlas}`, req.url), 307);
  }
  for (const root of roots()) {
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) continue;
    if (!(await exists(file))) continue;
    const body = await fs.readFile(file);
    const type = rel.toLowerCase().endsWith(".png") ? "image/png" : rel.toLowerCase().endsWith(".webp") ? "image/webp" : rel.toLowerCase().endsWith(".jpg") || rel.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream";
    return new Response(body, { status: 200, headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  }
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}