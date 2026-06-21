// @ts-nocheck
import { db } from "./db";

export type WorldSyncScope = "world" | "all";

const WORLD_TABLES = ["players", "tiles", "buildings", "doodads", "loot", "chat", "offers", "events", "meta"];
const ALL_TABLES = [...WORLD_TABLES, "walletChallenges", "redemptions"];
const ALLOWED_TABLES = new Set(ALL_TABLES);

function tablesFor(scope: any) {
  return String(scope || "world") === "all" ? ALL_TABLES : WORLD_TABLES;
}
function assertTable(t: string) {
  if (!ALLOWED_TABLES.has(t)) throw new Error(`Unsafe table: ${t}`);
  return t;
}
function qident(t: string) { return `"${assertTable(t).replace(/"/g, "")}"`; }
function qcol(c: string) { return `"${String(c).replace(/"/g, "")}"`; }
function rawAll(sql: string, ...args: any[]) {
  const q = (db as any).query?.(sql);
  if (!q) throw new Error("DB raw query API is unavailable");
  return q.all(...args);
}
function rawGet(sql: string, ...args: any[]) {
  const q = (db as any).query?.(sql);
  if (!q) throw new Error("DB raw query API is unavailable");
  return q.get(...args);
}
function rawRun(sql: string, ...args: any[]) {
  const q = (db as any).query?.(sql);
  if (!q) throw new Error("DB raw query API is unavailable");
  return q.run(...args);
}
function tableExists(t: string) {
  try { rawGet(`select 1 from ${qident(t)} limit 1`); return true; } catch { return false; }
}
function columnsOf(t: string) {
  try { return rawAll(`pragma table_info(${qident(t)})`).map((r: any) => String(r.name)); } catch { return []; }
}
function normalizeRowForInsert(row: any, cols: string[]) {
  const out: any = {};
  for (const c of cols) {
    if (!(c in row)) continue;
    const v = row[c];
    out[c] = v && typeof v === "object" ? JSON.stringify(v) : v;
  }
  return out;
}
function insertRow(t: string, row: any, cols: string[]) {
  const clean = normalizeRowForInsert(row, cols);
  const keys = Object.keys(clean).filter((k) => cols.includes(k));
  if (!keys.length) return;
  const sql = `insert into ${qident(t)} (${keys.map(qcol).join(",")}) values (${keys.map(() => "?").join(",")})`;
  rawRun(sql, ...keys.map((k) => clean[k]));
}
function safeJson(v: any, fallback: any) {
  if (v && typeof v === "object") return v;
  try { return JSON.parse(String(v || "")); } catch { return fallback; }
}
export function makeWorldExport(scope: WorldSyncScope = "world") {
  const tables: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  for (const t of tablesFor(scope)) {
    if (!tableExists(t)) { tables[t] = []; counts[t] = 0; continue; }
    const rows = rawAll(`select * from ${qident(t)} order by id asc`);
    tables[t] = rows;
    counts[t] = rows.length;
  }
  const players = (tables.players || []).map((p: any) => ({
    id: p.id,
    name: p.name || `Player ${p.id}`,
    wallet: p.wallet || "",
    x: Number(p.x || 0),
    z: Number(p.z || 0),
    body: Number(p.body || 0),
    hat: Number(p.hat || 0),
    lastSeen: Number(p.lastSeen || 0),
    profileDone: Number(p.profileDone || 0),
  }));
  return {
    ok: true,
    kind: "solcraft-world-export",
    version: 1,
    scope,
    generatedAt: Date.now(),
    counts,
    players,
    tables,
  };
}
export function worldSyncSummary(scope: WorldSyncScope = "world") {
  const out = makeWorldExport(scope);
  return { ok: true, scope, generatedAt: out.generatedAt, counts: out.counts, players: out.players };
}
export function importWorldExport(snapshot: any, opts: { scope?: WorldSyncScope; replace?: boolean } = {}) {
  if (!snapshot || snapshot.kind !== "solcraft-world-export" || !snapshot.tables) throw new Error("Invalid SolCraft world export");
  const scope = opts.scope || snapshot.scope || "world";
  const tables = tablesFor(scope).filter((t) => snapshot.tables[t]);
  const before = worldSyncSummary(scope).counts;
  (db as any).exec("PRAGMA foreign_keys = OFF");
  (db as any).exec("BEGIN IMMEDIATE");
  try {
    if (opts.replace !== false) {
      for (const t of [...tables].reverse()) {
        if (tableExists(t)) (db as any).exec(`DELETE FROM ${qident(t)}`);
      }
    }
    const inserted: Record<string, number> = {};
    for (const t of tables) {
      if (!tableExists(t)) { inserted[t] = 0; continue; }
      const cols = columnsOf(t);
      let n = 0;
      for (const row of snapshot.tables[t] || []) {
        insertRow(t, row, cols);
        n++;
      }
      inserted[t] = n;
    }
    (db as any).exec("COMMIT");
    const after = worldSyncSummary(scope).counts;
    return { ok: true, scope, importedAt: Date.now(), before, inserted, after };
  } catch (e) {
    try { (db as any).exec("ROLLBACK"); } catch {}
    throw e;
  }
}
export function localWorldPlayers() {
  const players = tableExists("players") ? rawAll(`select id,name,wallet,x,z,body,hat,lastSeen,profileDone,secret,inv,level,xp from ${qident("players")} order by lastSeen desc, id asc`) : [];
  const tileCounts = new Map((tableExists("tiles") ? rawAll(`select owner,count(*) as n from ${qident("tiles")} group by owner`) : []).map((r: any) => [Number(r.owner), Number(r.n || 0)]));
  const buildingCounts = new Map((tableExists("buildings") ? rawAll(`select owner,count(*) as n from ${qident("buildings")} group by owner`) : []).map((r: any) => [Number(r.owner), Number(r.n || 0)]));
  return players.map((p: any) => {
    const inv = safeJson(p.inv, {});
    return {
      id: Number(p.id),
      name: p.name || `Player ${p.id}`,
      wallet: p.wallet || "",
      x: Number(p.x || 0),
      z: Number(p.z || 0),
      body: Number(p.body || 0),
      hat: Number(p.hat || 0),
      lastSeen: Number(p.lastSeen || 0),
      profileDone: Number(p.profileDone || 0),
      level: Number(p.level || 1),
      xp: Number(p.xp || 0),
      coins: Number(inv.g || 0),
      science: Number(inv.sc || 0),
      tiles: tileCounts.get(Number(p.id)) || 0,
      buildings: buildingCounts.get(Number(p.id)) || 0,
      hasSecret: !!p.secret,
    };
  });
}
export function adminImpersonationPayload(playerId: any) {
  const id = Number(playerId || 0);
  const row = rawGet(`select id,name,secret,wallet,body,hat,x,z from ${qident("players")} where id = ?`, id) as any;
  if (!row) throw Object.assign(new Error("Player not found"), { status: 404, reasonCode: "PLAYER_NOT_FOUND" });
  if (!row.secret) throw Object.assign(new Error("Player has no local secret"), { status: 409, reasonCode: "NO_PLAYER_SECRET" });
  return {
    pid: Number(row.id),
    secret: String(row.secret),
    wallet: row.wallet || "",
    body: Number(row.body || 0),
    hat: Number(row.hat || 0),
    spectator: false,
    name: row.name || `Player ${row.id}`,
    x: Number(row.x || 0),
    z: Number(row.z || 0),
  };
}
