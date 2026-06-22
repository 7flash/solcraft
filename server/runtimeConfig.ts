import { db, metaGet, metaSet } from "./db";

const PREFIX = "solcraft:runtime:";
const ALLOWED = new Set([
  "economy.clean",
  "economy.reputation",
  "economy.storage",
  "economy.harvest",
  "economy.keep",
  "economy.npc",
  "combat.clean",
  "visual.clean",
]);

function key(name: string) { return `${PREFIX}${name}`; }
function safeName(value: any) { return String(value || "").trim().replace(/[^a-z0-9_.:-]+/gi, "").slice(0, 80); }
function safeJson(raw: any, fallback: any) { try { return JSON.parse(String(raw || "")); } catch { return fallback; } }

export function runtimeConfigList() {
  const rows = (db.meta.select().all() as any[]).filter((r) => String(r.k || "").startsWith(PREFIX));
  return rows.map((r) => ({ name: String(r.k).slice(PREFIX.length), value: safeJson(r.v, r.v), raw: r.v }));
}

export function runtimeConfigGet(name: string, fallback: any = null) {
  const n = safeName(name);
  if (!ALLOWED.has(n)) return fallback;
  return safeJson(metaGet(key(n), JSON.stringify(fallback)), fallback);
}

export function runtimeConfigSet(name: string, value: any, actor = "admin") {
  const n = safeName(name);
  if (!ALLOWED.has(n)) throw Object.assign(new Error("Unknown runtime config key."), { reasonCode: "CONFIG_KEY_NOT_ALLOWED" });
  const json = JSON.stringify(value ?? null);
  if (json.length > 64_000) throw Object.assign(new Error("Runtime config is too large."), { reasonCode: "CONFIG_TOO_LARGE" });
  metaSet(key(n), json);
  try {
    db.meta.insert({ k: `${PREFIX}history:${Date.now()}:${n}`, v: JSON.stringify({ name: n, actor, value, ts: Date.now() }) });
  } catch {}
  return { name: n, value };
}

export function runtimeConfigAllowedKeys() { return [...ALLOWED].sort(); }
