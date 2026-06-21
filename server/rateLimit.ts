export type RateLimitOptions = {
  capacity: number;
  refillPerSec: number;
  cost?: number;
  now?: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Bucket = { tokens: number; at: number; lastSeen: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function cleanKey(value: string) {
  return String(value || "anon").replace(/[^a-z0-9:._@-]+/gi, "_").slice(0, 160) || "anon";
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const ttl = 10 * 60_000;
  for (const [k, b] of buckets) if (now - b.lastSeen > ttl) buckets.delete(k);
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Number(options.now || Date.now());
  sweep(now);
  const capacity = Math.max(1, Number(options.capacity || 1));
  const refillPerSec = Math.max(0.001, Number(options.refillPerSec || 1));
  const cost = Math.max(0.001, Number(options.cost || 1));
  const id = cleanKey(key);
  const prev = buckets.get(id) || { tokens: capacity, at: now, lastSeen: now };
  const elapsed = Math.max(0, (now - prev.at) / 1000);
  const tokens = Math.min(capacity, prev.tokens + elapsed * refillPerSec);
  const ok = tokens >= cost;
  const nextTokens = ok ? tokens - cost : tokens;
  const retryAfterMs = ok ? 0 : Math.ceil(((cost - tokens) / refillPerSec) * 1000);
  buckets.set(id, { tokens: nextTokens, at: now, lastSeen: now });
  return { ok, remaining: Math.max(0, Math.floor(nextTokens)), retryAfterMs: Math.max(0, retryAfterMs) };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    ...(result.ok ? {} : { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) }),
  };
}

export function rateLimitStatus() {
  return { buckets: buckets.size, lastSweep };
}
