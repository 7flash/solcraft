// @ts-nocheck
import { promises as fs } from "fs";
import path from "path";
import { metaGet } from "@server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_AUDIO = "solcraft:audio:background:v1";
function safeJson<T>(raw: string, fallback: T): T { try { return JSON.parse(raw || ""); } catch { return fallback; } }
function readAudio() { return safeJson<any>(metaGet(META_AUDIO, "{}"), {}); }
function mimeFor(fileName: string) {
  const ext = path.extname(fileName || "").toLowerCase();
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".webm") return "audio/webm";
  return "audio/mpeg";
}
async function exists(p: string) { try { await fs.access(p); return true; } catch { return false; } }
export async function GET() {
  const bg = readAudio();
  if (!bg?.fileName) return new Response("No background music uploaded", { status: 404 });
  const candidates = [
    bg.filePath,
    path.join(process.cwd(), "public", "assets", "solcraft", "audio", bg.fileName),
    path.join(process.cwd(), "app", "assets", "solcraft", "audio", bg.fileName),
  ].filter(Boolean);
  for (const p of candidates) {
    if (await exists(p)) {
      const body = await fs.readFile(p);
      return new Response(body, { status: 200, headers: { "Content-Type": bg.mime || mimeFor(bg.fileName), "Cache-Control": "no-store", "X-SolCraft-Audio": String(bg.fileName) } });
    }
  }
  return new Response("Background music file missing", { status: 404 });
}
