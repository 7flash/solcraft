/* ============================================================
   SolCraft compact measurement logger.

   Do not log raw endpoint/snapshot results here. Some payloads contain
   base64 images (faceImage), full maps, inventories, and other large
   objects. Callers may pass a third-argument summarizer; otherwise we log
   only a tiny sanitized shape summary.
   ============================================================ */

type SummaryFn<T> = (value: T) => any;

const MAX_STRING = 160;
const MAX_ARRAY_ITEMS = 4;
const MAX_OBJECT_KEYS = 14;
const MAX_DEPTH = 3;

function safeString(s: string) {
  if (s.startsWith("data:image/")) {
    const mime = s.slice(5, Math.max(5, s.indexOf(";", 5) > 0 ? s.indexOf(";", 5) : 24));
    return `<${mime} data-url ${s.length} chars>`;
  }
  if (s.startsWith("data:")) return `<data-url ${s.length} chars>`;
  if (s.length > MAX_STRING) return `${s.slice(0, MAX_STRING)}… <${s.length} chars>`;
  return s;
}

export function sanitizeMeasureValue(value: any, depth = 0, seen = new WeakSet<object>()): any {
  if (value == null) return value;
  const t = typeof value;
  if (t === "string") return safeString(value);
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  if (t === "function") return `<function ${value.name || "anonymous"}>`;
  if (t !== "object") return String(value);
  if (seen.has(value)) return "<circular>";
  seen.add(value);

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `<array len=${value.length}>`;
    const out = value.slice(0, MAX_ARRAY_ITEMS).map((v) => sanitizeMeasureValue(v, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) out.push(`… +${value.length - MAX_ARRAY_ITEMS} more`);
    return out;
  }

  // Response objects and binary-ish things are never helpful in hot logs.
  const ctor = value?.constructor?.name;
  if (ctor && /^(Response|Request|Blob|File|Buffer|ArrayBuffer|Uint8Array)$/i.test(ctor)) {
    return `<${ctor}>`;
  }

  if (depth >= MAX_DEPTH) return `<object keys=${Object.keys(value).length}>`;

  const out: Record<string, any> = {};
  const keys = Object.keys(value);
  for (const k of keys.slice(0, MAX_OBJECT_KEYS)) {
    const lk = k.toLowerCase();
    if (lk.includes("secret") || lk.includes("token") || lk.includes("password")) {
      out[k] = "<redacted>";
    } else if (lk.includes("image") || lk.includes("base64") || lk.includes("dataurl")) {
      const v = value[k];
      out[k] = typeof v === "string" ? safeString(v) : sanitizeMeasureValue(v, depth + 1, seen);
    } else {
      out[k] = sanitizeMeasureValue(value[k], depth + 1, seen);
    }
  }
  if (keys.length > MAX_OBJECT_KEYS) out.__moreKeys = keys.length - MAX_OBJECT_KEYS;
  return out;
}

function shouldLogMeasure() {
  return process.env.SOLCRAFT_MEASURE !== "0";
}

function measureLine(label: string, started: number, summary: any, failed = false) {
  if (!shouldLogMeasure()) return;
  const ms = Date.now() - started;
  const safe = sanitizeMeasureValue(summary);
  const arrow = failed ? "✕" : "→";
  try {
    console.log(`[solcraft] ${label} ${ms}ms ${arrow} ${JSON.stringify(safe)}`);
  } catch {
    console.log(`[solcraft] ${label} ${ms}ms ${arrow} <unserializable>`);
  }
}

export async function measureSafe<T>(label: string, fn: () => Promise<T> | T, summarize?: SummaryFn<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    const summary = summarize ? summarize(result) : defaultSummary(result);
    measureLine(label, started, summary, false);
    return result;
  } catch (e: any) {
    measureLine(label, started, { ok: false, error: e?.message || String(e) }, true);
    throw e;
  }
}

export function measureSyncSafe<T>(label: string, fn: () => T, summarize?: SummaryFn<T>): T {
  const started = Date.now();
  try {
    const result = fn();
    const summary = summarize ? summarize(result) : defaultSummary(result);
    measureLine(label, started, summary, false);
    return result;
  } catch (e: any) {
    measureLine(label, started, { ok: false, error: e?.message || String(e) }, true);
    throw e;
  }
}

function defaultSummary(value: any) {
  if (value == null) return { value };
  if (typeof value !== "object") return { value };
  if (Array.isArray(value)) return { array: value.length };
  if ("ok" in value) return { ok: !!value.ok, msg: value.msg ? String(value.msg).slice(0, 120) : undefined };
  if ("id" in value) return { id: value.id, kind: value.kind || undefined };
  return { objectKeys: Object.keys(value).length };
}

export function snapshotMeasureFields(r: any, playerId: number) {
  const me = r?.me || {};
  const world = r?.world || {};
  return {
    ok: true,
    player: playerId,
    me: {
      id: me.id,
      x: me.x,
      z: me.z,
      energy: Math.round(Number(me.energy || 0) * 10) / 10,
      maxE: me.maxE,
      level: me.level,
      territory: me.territory,
      spectator: !!me.spectator,
      hasFaceImage: !!me.faceImage,
    },
    world: {
      rev: world.rev,
      ax: world.ax,
      az: world.az,
      tiles: world.tiles?.length || 0,
      buildings: world.buildings?.length || 0,
      doodads: world.doodads?.length || 0,
      loot: world.loot?.length || 0,
      map: !!world.map,
      mapTiles: world.map?.tiles?.length || 0,
      mapBuildings: world.map?.buildings?.length || 0,
      mapLoot: world.map?.loot?.length || 0,
      mapPlayers: world.map?.players?.length || 0,
    },
    peers: r?.players?.length || 0,
    chat: r?.chat?.length || 0,
    events: r?.events?.length || 0,
    leaderboard: r?.leaderboard?.length || 0,
    quests: r?.me?.quests?.length || 0,
    requiredVersion: r?.requiredVersion || undefined,
  };
}