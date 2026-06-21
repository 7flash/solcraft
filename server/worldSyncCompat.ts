// @ts-nocheck
export type WorldSyncScope = "world" | "all";
export type WorldSyncCompatSource = "remote" | "paste" | "file" | "local";

export const WORLD_SYNC_KIND = "solcraft-world-export";

export const WORLD_TABLES = ["players", "tiles", "buildings", "doodads", "loot", "chat", "offers", "events", "meta"] as const;
export const ALL_TABLES = [...WORLD_TABLES, "walletChallenges", "redemptions"] as const;
const ALLOWED_TABLES = new Set<string>(ALL_TABLES as any);

function scopeOf(v: any): WorldSyncScope {
  return String(v || "world") === "all" ? "all" : "world";
}
function tablesFor(scope: WorldSyncScope) {
  return scope === "all" ? [...ALL_TABLES] : [...WORLD_TABLES];
}
function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function rowArray(v: any) {
  return Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : [];
}
function playerPreviewFromRows(rows: any[]) {
  return rowArray(rows).map((p: any) => ({
    id: safeNumber(p.id, 0),
    name: String(p.name || `Player ${p.id || "?"}`),
    wallet: String(p.wallet || ""),
    x: safeNumber(p.x, 0),
    z: safeNumber(p.z, 0),
    body: safeNumber(p.body, 0),
    hat: safeNumber(p.hat, 0),
    lastSeen: safeNumber(p.lastSeen, 0),
    profileDone: safeNumber(p.profileDone, 0),
  }));
}
function unwrapSnapshot(raw: any) {
  if (raw?.snapshot && typeof raw.snapshot === "object") return raw.snapshot;
  if (raw?.export && typeof raw.export === "object") return raw.export;
  if (raw?.world && typeof raw.world === "object" && raw.world.tables) return raw.world;
  return raw;
}
function countRows(tables: Record<string, any[]>) {
  const counts: Record<string, number> = {};
  for (const [k, rows] of Object.entries(tables || {})) counts[k] = rowArray(rows).length;
  return counts;
}
function remoteSummary(raw: any) {
  const r = safeObject(raw);
  return {
    kind: String(r.kind || ""),
    scope: r.scope,
    generatedAt: r.generatedAt,
    hasTables: !!r.tables,
    tableKeys: r.tables && typeof r.tables === "object" ? Object.keys(r.tables) : [],
    players: Array.isArray(r.players) ? r.players.length : undefined,
    counts: r.counts || null,
    ok: r.ok,
    msg: r.msg,
    reasonCode: r.reasonCode,
  };
}

export function normalizeWorldSyncSnapshot(rawValue: any, opts: { scope?: WorldSyncScope; source?: WorldSyncCompatSource } = {}) {
  const source = opts.source || "local";
  const raw = unwrapSnapshot(rawValue);
  const scope = scopeOf(opts.scope || raw?.scope);
  const warnings: string[] = [];
  const droppedTables: string[] = [];
  const filledTables: string[] = [];
  const summary = remoteSummary(raw);

  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      reasonCode: "SNAPSHOT_NOT_OBJECT",
      msg: "The selected world export is not a JSON object.",
      source,
      summary,
    };
  }

  if (!raw.tables || typeof raw.tables !== "object") {
    const looksLikeSummary = "players" in raw || "counts" in raw || "generatedAt" in raw || "scope" in raw;
    return {
      ok: false,
      reasonCode: looksLikeSummary ? "SUMMARY_ONLY_EXPORT" : "TABLES_MISSING",
      msg: looksLikeSummary
        ? "Production returned a summary-only response, not a full world export. Use manual export JSON, deploy the export route there later, or import a DB snapshot locally."
        : "The world export is missing its tables payload.",
      source,
      summary,
    };
  }

  const rawTables = safeObject(raw.tables);
  const tables: Record<string, any[]> = {};
  for (const [name, rows] of Object.entries(rawTables)) {
    if (!ALLOWED_TABLES.has(name)) { droppedTables.push(name); continue; }
    tables[name] = rowArray(rows);
  }
  for (const table of tablesFor(scope)) {
    if (!tables[table]) { tables[table] = []; filledTables.push(table); }
  }

  const counts = { ...countRows(tables), ...safeObject(raw.counts) };
  for (const [k, rows] of Object.entries(tables)) counts[k] = rowArray(rows).length;
  const players = Array.isArray(raw.players) && raw.players.length ? rowArray(raw.players) : playerPreviewFromRows(tables.players || []);
  if (raw.kind && raw.kind !== WORLD_SYNC_KIND) warnings.push(`Export kind was ${raw.kind}; normalized to ${WORLD_SYNC_KIND}.`);
  if (droppedTables.length) warnings.push(`Ignored unsupported table(s): ${droppedTables.join(", ")}.`);
  if (filledTables.length) warnings.push(`Filled missing optional table(s): ${filledTables.join(", ")}.`);
  if (!players.length) warnings.push("No players were found in this export. Check the admin key, production URL, or export source before importing.");

  const snapshot = {
    ok: true,
    kind: WORLD_SYNC_KIND,
    version: safeNumber(raw.version, 1) || 1,
    scope,
    generatedAt: safeNumber(raw.generatedAt, Date.now()) || Date.now(),
    counts,
    players,
    tables,
  };

  return {
    ok: true,
    source,
    reasonCode: "OK",
    msg: `Compatible ${scope} world export: ${players.length} player(s), ${counts.tiles || 0} tile(s), ${counts.buildings || 0} building(s).`,
    snapshot,
    report: {
      source,
      scope,
      kind: snapshot.kind,
      version: snapshot.version,
      generatedAt: snapshot.generatedAt,
      counts,
      players: players.length,
      tableKeys: Object.keys(tables).sort(),
      droppedTables,
      filledTables,
      warnings,
    },
  };
}

export function assertCompatibleWorldSyncSnapshot(raw: any, opts: { scope?: WorldSyncScope; source?: WorldSyncCompatSource } = {}) {
  const result = normalizeWorldSyncSnapshot(raw, opts);
  if (!result.ok) {
    throw Object.assign(new Error(result.msg || "World export is not compatible."), {
      status: 400,
      reasonCode: result.reasonCode || "WORLD_EXPORT_INCOMPATIBLE",
      details: result,
    });
  }
  return result;
}
