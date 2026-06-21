// @ts-nocheck
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { metaGet, metaSet } from "@server/db";
import { atlasLegacyRecord } from "@server/atlasCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bounds = { x0: number; y0: number; x1: number; y1: number };
type Version = { id: string; atlasId: string; label: string; url: string; fileName: string; filePath?: string; createdAt: number; published?: boolean; w?: number; h?: number };

const ATLAS = atlasLegacyRecord();

const META_VERSIONS = "solcraft:atlas:versions:v3";
const META_PUBLISHED = "solcraft:atlas:publishedByAtlas:v3";
const META_BOUNDS = "solcraft:atlas:boundsByAtlas:v3";
const META_PADS = "solcraft:atlas:padByAtlas:v3";
const META_MODES = "solcraft:atlas:modes:v3";
const META_RUNTIME_CACHE = "solcraft:atlas:runtimeCacheBust:v3";
const DEFAULT_BOUNDS: Bounds = { x0: 0, y0: 0, x1: 1024, y1: 1024 };

function ok(extra: Record<string, any> = {}, init?: ResponseInit) { return Response.json({ ok: true, ...extra }, init); }
function fail(msg: string, status = 400, extra: Record<string, any> = {}) { return Response.json({ ok: false, msg, ...extra }, { status }); }
function safeJson<T>(raw: string, fallback: T): T { try { return JSON.parse(raw || "") as T; } catch { return fallback; } }
function atlasId(value: any): keyof typeof ATLAS { const id = String(value || "terrain").toLowerCase(); if (id in ATLAS) return id as keyof typeof ATLAS; throw new Error(`invalid atlasId: ${id}`); }
function cleanName(value: any) { return String(value || "atlas.png").replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+/, "").slice(0, 140) || "atlas.png"; }
function publicDir() { return path.join(process.cwd(), "public", "assets", "solcraft"); }
function appFilesDir() { return path.join(process.cwd(), "app", "assets", "solcraft", "_files"); }
function versionDir(atlas: string) { return path.join(publicDir(), "atlas-versions", atlas); }
function appVersionDir(atlas: string) { return path.join(appFilesDir(), "atlas-versions", atlas); }
function versionUrl(atlas: string, id: string, createdAt: number) { return `/api/admin/atlas?atlas=${encodeURIComponent(atlas)}&image=${encodeURIComponent(id)}&v=${encodeURIComponent(String(createdAt))}`; }
function runtimeUrl(atlas: string, v: string | number = Date.now()) { return `/api/atlas-runtime/${encodeURIComponent(String(atlas))}?v=${encodeURIComponent(String(v))}`; }
async function exists(p: string) { try { await fs.access(p); return true; } catch { return false; } }
async function ensureDirs(atlas?: string) { await fs.mkdir(publicDir(), { recursive: true }); await fs.mkdir(appFilesDir(), { recursive: true }); if (atlas) { await fs.mkdir(versionDir(atlas), { recursive: true }); await fs.mkdir(appVersionDir(atlas), { recursive: true }); } }
function pngSize(buf: Buffer) { try { if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; } catch {} return { w: 0, h: 0 }; }
function readVersions(): Version[] { return safeJson<Version[]>(metaGet(META_VERSIONS, "[]"), []); }
function writeVersions(v: Version[]) { metaSet(META_VERSIONS, JSON.stringify(v)); }
function readPublished(): Record<string, Version> { return safeJson<Record<string, Version>>(metaGet(META_PUBLISHED, "{}"), {}); }
function writePublished(v: Record<string, Version>) { metaSet(META_PUBLISHED, JSON.stringify(v)); }
function readBounds(): Record<string, Bounds> { return safeJson<Record<string, Bounds>>(metaGet(META_BOUNDS, "{}"), {}); }
function writeBounds(v: Record<string, Bounds>) { metaSet(META_BOUNDS, JSON.stringify(v)); }
function readPads(): Record<string, number> { return safeJson<Record<string, number>>(metaGet(META_PADS, "{}"), {}); }
function writePads(v: Record<string, number>) { metaSet(META_PADS, JSON.stringify(v)); }
function readModes(): Record<string, string> { return safeJson<Record<string, string>>(metaGet(META_MODES, "{}"), { terrain: "procedural", building: "atlas", fx: "atlas", ui: "atlas", doll: "atlas", tool: "atlas" }); }
function writeModes(v: Record<string, string>) { metaSet(META_MODES, JSON.stringify(v)); }
function readCache(): Record<string, number> { return safeJson<Record<string, number>>(metaGet(META_RUNTIME_CACHE, "{}"), {}); }
function writeCache(v: Record<string, number>) { metaSet(META_RUNTIME_CACHE, JSON.stringify(v)); }
function normalizeMode(atlas: string, value: any) { const raw = String(value || "").toLowerCase(); if (atlas === "terrain") return raw === "atlas" ? "atlas" : "procedural"; return raw === "procedural" ? "procedural" : "atlas"; }
function normalizeBounds(raw: any, fallback = DEFAULT_BOUNDS): Bounds { const b = raw || {}; const x0 = Math.max(0, Math.trunc(Number(b.x0 ?? fallback.x0) || 0)); const y0 = Math.max(0, Math.trunc(Number(b.y0 ?? fallback.y0) || 0)); const x1 = Math.max(x0 + 1, Math.trunc(Number(b.x1 ?? fallback.x1) || fallback.x1)); const y1 = Math.max(y0 + 1, Math.trunc(Number(b.y1 ?? fallback.y1) || fallback.y1)); return { x0, y0, x1, y1 }; }
function inferAtlasFromName(file: string): keyof typeof ATLAS | "" { const lower = file.toLowerCase(); for (const id of Object.keys(ATLAS) as (keyof typeof ATLAS)[]) if (lower.includes(id)) return id; return ""; }
async function readImageForGet(atlas: keyof typeof ATLAS, image: string) { const id = cleanName(image).replace(/.png$/i, ""); const candidates = [path.join(versionDir(atlas), `${id}.png`), path.join(appVersionDir(atlas), `${id}.png`)]; for (const p of candidates) if (await exists(p)) return fs.readFile(p); return null; }
async function scanDiskVersions(existing: Version[]) {
  const byKey = new Map<string, Version>();
  for (const v of existing || []) if (v?.atlasId && v?.id && v?.url) byKey.set(`${v.atlasId}|${v.id}`, v);
  for (const atlas of Object.keys(ATLAS) as (keyof typeof ATLAS)[]) {
    await ensureDirs(atlas);
    for (const dir of [versionDir(atlas), appVersionDir(atlas)]) {
      const files = await fs.readdir(dir).catch(() => []);
      for (const f of files) {
        if (!/.(png|webp|jpe?g)$/i.test(f)) continue;
        const id = cleanName(f).replace(/.(png|webp|jpe?g)$/i, "");
        const file = path.join(dir, f);
        const stat = await fs.stat(file).catch(() => null);
        const createdAt = Math.floor(Number(stat?.mtimeMs || Date.now()));
        const buf = await fs.readFile(file).catch(() => null);
        const size = buf ? pngSize(buf) : { w: 0, h: 0 };
        byKey.set(`${atlas}|${id}`, { id, atlasId: atlas, label: f, url: versionUrl(atlas, id, createdAt), fileName: `${id}.png`, filePath: path.join(versionDir(atlas), `${id}.png`), createdAt, w: size.w || undefined, h: size.h || undefined });
      }
    }
    const runtimeFile = path.join(publicDir(), ATLAS[atlas].runtimeFile);
    if (await exists(runtimeFile)) {
      const stat = await fs.stat(runtimeFile).catch(() => null);
      const createdAt = Math.floor(Number(stat?.mtimeMs || Date.now()));
      const buf = await fs.readFile(runtimeFile).catch(() => null);
      const size = buf ? pngSize(buf) : { w: 0, h: 0 };
      byKey.set(`${atlas}|${atlas}:runtime`, { id: `${atlas}:runtime`, atlasId: atlas, label: `${ATLAS[atlas].label} runtime`, url: runtimeUrl(atlas, createdAt), fileName: ATLAS[atlas].runtimeFile, filePath: runtimeFile, createdAt, published: true, w: size.w || undefined, h: size.h || undefined });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => Number(b.published) - Number(a.published) || Number(b.createdAt || 0) - Number(a.createdAt || 0));
}
async function saveUploaded(atlas: keyof typeof ATLAS, file: any): Promise<Version> {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("No file uploaded.");
  await ensureDirs(atlas);
  const rawName = cleanName(file.name || `${atlas}.png`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 32) throw new Error("Uploaded file is empty.");
  const ext = path.extname(rawName).toLowerCase() || ".png";
  const createdAt = Date.now();
  const id = `${atlas}_${createdAt}_${crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8)}`;
  const fileName = `${id}.png`;
  const publicPath = path.join(versionDir(atlas), fileName);
  const mirrorPath = path.join(appVersionDir(atlas), fileName);
  await fs.writeFile(publicPath, buf);
  await fs.writeFile(mirrorPath, buf).catch(() => {});
  const size = pngSize(buf);
  return { id, atlasId: atlas, label: rawName, url: versionUrl(atlas, id, createdAt), fileName, filePath: publicPath, createdAt, published: false, w: size.w || undefined, h: size.h || undefined };
}
function getVersion(versions: Version[], atlas: string, id: string) { return versions.find((v) => v.atlasId === atlas && v.id === id) || versions.find((v) => v.atlasId === atlas && cleanName(v.fileName || "").replace(/.png$/i, "") === id); }
async function copyToRuntime(atlas: keyof typeof ATLAS, version: Version) {
  await ensureDirs(atlas);
  const candidates = [version.filePath || "", path.join(versionDir(atlas), version.fileName || `${version.id}.png`), path.join(appVersionDir(atlas), version.fileName || `${version.id}.png`)];
  for (const p of candidates) {
    if (p && await exists(p)) {
      const body = await fs.readFile(p);
      await fs.writeFile(path.join(publicDir(), ATLAS[atlas].runtimeFile), body).catch(() => {});
      await fs.writeFile(path.join(appFilesDir(), ATLAS[atlas].runtimeFile), body).catch(() => {});
      return;
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    const atlas = atlasId(url.searchParams.get("atlas") || "terrain");
    const image = url.searchParams.get("image");
    if (image) {
      const body = await readImageForGet(atlas, image);
      if (!body) return new Response("Atlas image not found", { status: 404, headers: { "Cache-Control": "no-store" } });
      return new Response(body, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-SolCraft-Atlas-Image": `${atlas}/${image}` } });
    }
    const versions = await scanDiskVersions(readVersions());
    writeVersions(versions);
    const publishedByAtlas = readPublished();
    for (const a of Object.keys(ATLAS) as (keyof typeof ATLAS)[]) {
      const runtime = versions.find((v) => v.atlasId === a && (v.published || v.id === `${a}:runtime`));
      if (!publishedByAtlas[a] && runtime) publishedByAtlas[a] = runtime;
    }
    return ok({ versions, images: versions, publishedByAtlas, boundsByAtlas: readBounds(), padByAtlas: readPads(), modesByAtlas: readModes(), runtimeCacheBustByAtlas: readCache() });
  } catch (e: any) { return fail(String(e?.message || e || "atlas GET failed"), 400); }
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const atlas = atlasId(form.get("atlasId") || form.get("atlas") || form.get("kind") || "terrain");
      const version = await saveUploaded(atlas, form.get("file") || form.get("image") || form.get("png"));
      const versions = [version, ...readVersions().filter((v) => !(v.atlasId === version.atlasId && v.id === version.id))];
      writeVersions(versions);
      return ok({ version, image: version, versions: await scanDiskVersions(versions), publishedByAtlas: readPublished(), boundsByAtlas: readBounds(), padByAtlas: readPads(), modesByAtlas: readModes() });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || body.type || "");
    const atlas = atlasId(body.atlasId || body.atlas || body.kind || "terrain");
    let versions = await scanDiskVersions(readVersions());
    if (action === "saveCoordinates" || action === "save" || action === "coordinates") {
      const bounds = readBounds();
      const pads = readPads();
      bounds[atlas] = normalizeBounds(body.bounds || body.crop || bounds[atlas] || DEFAULT_BOUNDS);
      pads[atlas] = Math.max(0, Math.trunc(Number(body.pad ?? body.inset ?? pads[atlas] ?? 0) || 0));
      writeBounds(bounds); writePads(pads);
      return ok({ versions, images: versions, publishedByAtlas: readPublished(), boundsByAtlas: bounds, padByAtlas: pads, modesByAtlas: readModes() });
    }
    if (action === "setMode" || action === "mode") {
      const modes = readModes();
      modes[atlas] = normalizeMode(atlas, body.mode || body.value);
      writeModes(modes);
      return ok({ versions, images: versions, publishedByAtlas: readPublished(), boundsByAtlas: readBounds(), padByAtlas: readPads(), modesByAtlas: modes });
    }
    if (action === "forceRefresh" || action === "refresh") {
      const cache = readCache();
      cache[atlas] = Date.now();
      writeCache(cache);
      return ok({ versions, images: versions, publishedByAtlas: readPublished(), boundsByAtlas: readBounds(), padByAtlas: readPads(), modesByAtlas: readModes(), runtimeCacheBustByAtlas: cache });
    }
    if (action === "publish") {
      const versionId = String(body.versionId || body.id || "");
      const version = getVersion(versions, atlas, versionId);
      if (!version) return fail(`version not found: ${versionId}`, 404, { atlas, versionId });
      await copyToRuntime(atlas, version);
      const bounds = readBounds(); const pads = readPads(); const cache = readCache();
      bounds[atlas] = normalizeBounds(body.bounds || body.crop || bounds[atlas] || DEFAULT_BOUNDS);
      pads[atlas] = Math.max(0, Math.trunc(Number(body.pad ?? body.inset ?? pads[atlas] ?? 0) || 0));
      cache[atlas] = Date.now();
      writeBounds(bounds); writePads(pads); writeCache(cache);
      const published = readPublished();
      const pub = { ...version, published: true, url: runtimeUrl(atlas, cache[atlas]), createdAt: cache[atlas] };
      published[atlas] = pub;
      writePublished(published);
      versions = versions.map((v) => v.atlasId === atlas ? { ...v, published: v.id === version.id } : v);
      writeVersions(versions);
      return ok({ version, published: pub, versions, images: versions, publishedByAtlas: published, boundsByAtlas: bounds, padByAtlas: pads, modesByAtlas: readModes(), runtimeCacheBustByAtlas: cache });
    }
    if (action === "delete") {
      const versionId = String(body.versionId || body.id || "");
      const version = getVersion(versions, atlas, versionId);
      if (!version) return fail(`version not found: ${versionId}`, 404);
      if (version.published || version.id === `${atlas}:runtime`) return fail("Refusing to delete the active runtime atlas. Publish another image first.", 400);
      for (const p of [version.filePath || "", path.join(versionDir(atlas), version.fileName || `${version.id}.png`), path.join(appVersionDir(atlas), version.fileName || `${version.id}.png`)]) if (p) await fs.unlink(p).catch(() => {});
      versions = versions.filter((v) => !(v.atlasId === atlas && v.id === versionId));
      writeVersions(versions);
      return ok({ versions, images: versions, publishedByAtlas: readPublished(), boundsByAtlas: readBounds(), padByAtlas: readPads(), modesByAtlas: readModes() });
    }
    return fail(`unknown atlas action: ${action || "(empty)"}`, 400, { received: body });
  } catch (e: any) { return fail(String(e?.message || e || "atlas POST failed"), 400); }
}
