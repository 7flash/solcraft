export type JsonErrorOptions = { status?: number; reasonCode?: string; headers?: HeadersInit };

export function noStoreHeaders(extra: HeadersInit = {}) {
  return { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(extra).entries()) };
}

export function jsonError(msg: string, opts: JsonErrorOptions = {}) {
  return Response.json({ ok: false, msg, reasonCode: opts.reasonCode || "BAD_REQUEST" }, {
    status: opts.status || 400,
    headers: noStoreHeaders(opts.headers),
  });
}

export function jsonOk(body: Record<string, any>, headers: HeadersInit = {}) {
  return Response.json({ ok: true, ...body }, { headers: noStoreHeaders(headers) });
}

export async function readJsonLimited(req: Request, maxBytes = 260_000) {
  const len = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(len) && len > maxBytes) {
    const e: any = new Error("Request body is too large.");
    e.reasonCode = "BODY_TOO_LARGE";
    e.status = 413;
    throw e;
  }
  const body = await req.json().catch(() => ({}));
  return body && typeof body === "object" ? body : {};
}

export function bearerSecret(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export function secretFrom(req: Request, fallback = "") {
  return bearerSecret(req) || req.headers.get("x-solcraft-secret") || fallback || "";
}

export function playerIdFrom(req: Request, fallback: any = 0) {
  const raw = req.headers.get("x-solcraft-player") || fallback || 0;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? n : 0;
}

export function intParam(url: URL, key: string, fallback: number, min = -1_000_000, max = 1_000_000) {
  const n = Math.trunc(Number(url.searchParams.get(key) || fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
