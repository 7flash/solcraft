export type BackendRequestContext = {
  requestId: string;
  route: string;
  method?: string;
  playerId?: number;
  wallet?: string;
  action?: string;
  backend?: string;
  ip?: string;
  userAgent?: string;
  startedAt: number;
};

function shortId() {
  try {
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID().slice(0, 12);
  } catch {}
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12);
}

function cleanShort(value: unknown, max = 80) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

export function remoteIp(req: Request) {
  return cleanShort(
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local",
    64,
  );
}

export function createRequestContext(req: Request, seed: Partial<BackendRequestContext> = {}): BackendRequestContext {
  const requestId = cleanShort(
    req.headers.get("x-request-id") || req.headers.get("x-solcraft-request-id") || seed.requestId || shortId(),
    40,
  );
  return {
    requestId,
    route: cleanShort(seed.route || new URL(req.url).pathname, 96),
    method: cleanShort(seed.method || req.method, 12),
    playerId: Number.isFinite(Number(seed.playerId)) ? Math.trunc(Number(seed.playerId)) : undefined,
    wallet: seed.wallet ? cleanShort(seed.wallet, 64) : undefined,
    action: seed.action ? cleanShort(seed.action, 48) : undefined,
    backend: seed.backend ? cleanShort(seed.backend, 24) : undefined,
    ip: seed.ip || remoteIp(req),
    userAgent: cleanShort(req.headers.get("user-agent") || "", 120),
    startedAt: seed.startedAt || Date.now(),
  };
}

export function withRequestContext(ctx: BackendRequestContext, patch: Partial<BackendRequestContext>) {
  return { ...ctx, ...patch, startedAt: ctx.startedAt || Date.now() } as BackendRequestContext;
}

export function contextFields(ctx: Partial<BackendRequestContext> = {}) {
  return {
    rid: ctx.requestId || "",
    uid: ctx.playerId || 0,
    route: ctx.route || "",
    action: ctx.action || "",
    backend: ctx.backend || "",
  };
}

export function elapsedMs(ctx: Partial<BackendRequestContext> = {}) {
  return Math.max(0, Date.now() - Number(ctx.startedAt || Date.now()));
}
