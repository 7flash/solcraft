// @ts-nocheck
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { metaGet, metaSet } from "@server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_AUDIO = "solcraft:audio-runtime:v1";
const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const ALLOWED_EXT = new Set([".mp3", ".m4a", ".ogg", ".oga", ".wav", ".webm", ".aac", ".flac"]);

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
    return Response.json({ ok: false, reasonCode: "UNAUTHORIZED", msg: "Unauthorized admin key" }, { status: 401 });
  }
  return null;
}
function clamp01(v: any, fallback = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}
function safeFileName(name: string) {
  const base = String(name || "music").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "music";
  return base.includes(".") ? base : `${base}.mp3`;
}
function runtimeAudioUrl(nameOrUrl: string) {
  const raw = String(nameOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/api/audio-file/")) return raw;
  const m = raw.match(/\/uploads\/audio\/([^?#]+)/);
  if (m) return `/api/audio-file/${encodeURIComponent(m[1])}`;
  if (!raw.includes("/") && !raw.includes("\\")) return `/api/audio-file/${encodeURIComponent(raw)}`;
  return raw;
}
function defaultAudioRuntime() {
  return { theme: "classic", uiVolume: 1, musicVolume: 0.72, backgroundUrl: "", fileName: "", updatedAt: 0 };
}
function readAudioRuntime() {
  let raw: any = {};
  try { raw = JSON.parse(metaGet(META_AUDIO, "{}") || "{}"); } catch { raw = {}; }
  const base = defaultAudioRuntime();
  return {
    theme: ["classic", "bright", "soft", "retro"].includes(String(raw.theme || "")) ? String(raw.theme) : base.theme,
    uiVolume: clamp01(raw.uiVolume, base.uiVolume),
    musicVolume: clamp01(raw.musicVolume, base.musicVolume),
    backgroundUrl: runtimeAudioUrl(String(raw.backgroundUrl || raw.url || "")),
    fileName: String(raw.fileName || ""),
    updatedAt: Number(raw.updatedAt || 0) || 0,
  };
}
function writeAudioRuntime(patch: any = {}) {
  const prev = readAudioRuntime();
  const next = {
    ...prev,
    ...patch,
    theme: ["classic", "bright", "soft", "retro"].includes(String(patch.theme ?? prev.theme)) ? String(patch.theme ?? prev.theme) : "classic",
    uiVolume: clamp01(patch.uiVolume ?? prev.uiVolume, prev.uiVolume),
    musicVolume: clamp01(patch.musicVolume ?? prev.musicVolume, prev.musicVolume),
    backgroundUrl: runtimeAudioUrl(String(patch.backgroundUrl ?? prev.backgroundUrl ?? "")),
    fileName: String(patch.fileName ?? prev.fileName ?? ""),
    updatedAt: Number(patch.updatedAt || Date.now()),
  };
  metaSet(META_AUDIO, JSON.stringify(next));
  return next;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const blocked = assertAdmin(req, url, {});
  if (blocked) return blocked;
  const audio = readAudioRuntime();
  return Response.json({ ok: true, audio }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const body = Object.fromEntries(form.entries());
    const blocked = assertAdmin(req, url, body);
    if (blocked) return blocked;
    const file = form.get("file") as File | null;
    if (!file || typeof file.arrayBuffer !== "function") return Response.json({ ok: false, msg: "Choose an audio file first." }, { status: 400 });
    if (file.size > MAX_AUDIO_BYTES) return Response.json({ ok: false, msg: "Audio file is too large. Keep it under 40 MB." }, { status: 413 });
    const ext = path.extname(safeFileName(file.name)).toLowerCase() || ".mp3";
    const mime = String(file.type || "");
    if (!ALLOWED_EXT.has(ext) && !mime.startsWith("audio/")) return Response.json({ ok: false, msg: "Upload an audio file: mp3, m4a, ogg, wav, webm, aac, or flac." }, { status: 400 });
    const dir = path.join(process.cwd(), "public", "uploads", "audio");
    await mkdir(dir, { recursive: true });
    const name = `solcraft-bg-${Date.now()}-${safeFileName(file.name)}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const audio = writeAudioRuntime({ backgroundUrl: `/api/audio-file/${encodeURIComponent(name)}`, fileName: file.name || name, updatedAt: Date.now() });
    return Response.json({ ok: true, audio, msg: `Uploaded ${file.name || name}.` }, { headers: { "Cache-Control": "no-store" } });
  }

  const body = await req.json().catch(() => ({}));
  const blocked = assertAdmin(req, url, body);
  if (blocked) return blocked;

  if (body.action === "reset") {
    const audio = writeAudioRuntime({ ...defaultAudioRuntime(), updatedAt: Date.now() });
    return Response.json({ ok: true, audio, msg: "Audio runtime reset." }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action === "clear-background") {
    const audio = writeAudioRuntime({ backgroundUrl: "", fileName: "", updatedAt: Date.now() });
    return Response.json({ ok: true, audio, msg: "Background music cleared." }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action === "save") {
    const raw = body.audio || {};
    const audio = writeAudioRuntime({
      theme: raw.theme,
      uiVolume: raw.uiVolume,
      musicVolume: raw.musicVolume,
      backgroundUrl: raw.backgroundUrl,
      fileName: raw.fileName,
      updatedAt: Date.now(),
    });
    return Response.json({ ok: true, audio, msg: "Audio runtime saved." }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ ok: false, msg: "Unknown audio admin action." }, { status: 400 });
}
