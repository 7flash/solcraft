// @ts-nocheck
import { readFile, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".ogg": "audio/ogg", ".oga": "audio/ogg", ".wav": "audio/wav",
  ".webm": "audio/webm", ".flac": "audio/flac",
};
function safeName(value: any) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 160);
}
export async function GET(req: Request, ctx: any) {
  const name = safeName(ctx?.params?.name);
  if (!name) return new Response("missing audio file", { status: 404 });
  const full = path.join(process.cwd(), "public", "uploads", "audio", name);
  try {
    const st = await stat(full);
    if (!st.isFile()) return new Response("not found", { status: 404 });
    const total = Number(st.size || 0);
    const ext = path.extname(name).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    const range = req.headers.get("range") || "";
    const data = await readFile(full);
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m && total > 0) {
      const start = m[1] ? Math.max(0, Math.min(total - 1, Number(m[1]))) : 0;
      const end = m[2] ? Math.max(start, Math.min(total - 1, Number(m[2]))) : total - 1;
      const chunk = data.subarray(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return new Response("audio file not found", { status: 404 });
  }
}
