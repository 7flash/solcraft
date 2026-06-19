// @ts-nocheck
import { metaGet } from "../../../game/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_AUDIO = "solcraft:audio-runtime:v1";

function clamp01(v: any, fallback = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
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

export function defaultAudioRuntime() {
  return {
    theme: "classic",
    uiVolume: 1,
    musicVolume: 0.72,
    backgroundUrl: "",
    fileName: "",
    updatedAt: 0,
  };
}

export function readAudioRuntime() {
  let raw: any = {};
  try { raw = JSON.parse(metaGet(META_AUDIO, "{}") || "{}"); } catch { raw = {}; }
  const base = defaultAudioRuntime();
  const theme = ["classic", "bright", "soft", "retro"].includes(String(raw.theme || "")) ? String(raw.theme) : base.theme;
  const backgroundUrl = runtimeAudioUrl(String(raw.backgroundUrl || raw.url || ""));
  return {
    theme,
    uiVolume: clamp01(raw.uiVolume, base.uiVolume),
    musicVolume: clamp01(raw.musicVolume, base.musicVolume),
    backgroundUrl,
    fileName: String(raw.fileName || ""),
    updatedAt: Number(raw.updatedAt || 0) || 0,
  };
}

export async function GET() {
  const audio = readAudioRuntime();
  return Response.json({
    ok: true,
    audio,
    background: { url: audio.backgroundUrl, fileName: audio.fileName, updatedAt: audio.updatedAt },
  }, { headers: { "Cache-Control": "no-store" } });
}
