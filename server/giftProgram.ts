// @ts-nocheck
import { createMeasure } from "measure-fn";
import { db } from "./db";

const giftMeasure = createMeasure("gifts", { maxResultLength: 140 });
const GIFT_KINDS = new Set(["cosmetic", "badge", "visualEquipment", "aura", "nameplate"]);

function now() { return Date.now(); }
function err(msg: string, reasonCode = "GIFT_FAILED", extra: Record<string, any> = {}) { return { ok: false, msg, reasonCode, ...extra }; }
function ok(extra: Record<string, any> = {}) { return { ok: true, ...extra }; }
function rawGet(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.get(...args); }
function rawAll(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.all(...args); }
function rawRun(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.run(...args); }
function exec(sql: string) { return (db as any).exec?.(sql); }
function tryExec(sql: string) { try { exec(sql); } catch {} }
function safeJson(value: any, fallback: any) { try { return JSON.parse(String(value || "")); } catch { return fallback; } }
function cleanId(value: any) { return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").replace(/-+/g, "-").slice(0, 80); }
function cleanKind(value: any) { const k = String(value || "cosmetic").trim(); return GIFT_KINDS.has(k) ? k : "cosmetic"; }
function cleanLabel(value: any) { return String(value || "Gift").trim().slice(0, 80) || "Gift"; }
function playerExists(id: number) { return !!rawGet("select id from players where id = ?", id); }

export function ensureGiftSchema() {
  exec(`create table if not exists giftGrants (
    id integer primary key autoincrement,
    grantId text not null unique,
    playerId integer not null,
    source text not null default 'admin',
    sourceRef text,
    kind text not null,
    itemId text not null,
    label text not null,
    giftJson text,
    status text not null default 'granted',
    equipped integer not null default 0,
    createdAt integer not null,
    claimedAt integer
  )`);
  exec(`create table if not exists playerCosmetics (
    id integer primary key autoincrement,
    playerId integer not null,
    slot text not null,
    itemId text not null,
    label text,
    sourceGrantId text,
    equipped integer not null default 0,
    createdAt integer not null,
    unique(playerId, slot, itemId)
  )`);
  tryExec("alter table giftGrants add column expiresAt integer");
  tryExec("alter table giftGrants add column adminNote text");
  exec("create index if not exists idx_gift_grants_player ON giftGrants(playerId, status, createdAt)");
  exec("create index if not exists idx_gift_grants_item ON giftGrants(kind, itemId)");
  exec("create index if not exists idx_player_cosmetics_player ON playerCosmetics(playerId, equipped)");
}

export function validateGiftJson(raw: any) {
  const gift = typeof raw === "string" ? safeJson(raw, {}) : (raw || {});
  const kind = cleanKind(gift.kind || gift.type);
  const itemId = cleanId(gift.itemId || gift.id || gift.visualEquipment || gift.badge || "founder-badge");
  const slot = cleanId(gift.slot || (kind === "badge" ? "badge" : kind === "nameplate" ? "nameplate" : kind === "aura" ? "aura" : "back"));
  const label = cleanLabel(gift.label || gift.name || itemId);
  return { kind, itemId, slot, label, giftJson: { ...gift, kind, itemId, slot, label } };
}

export function grantGiftToPlayer(admin: any, playerIdRaw: any, rawGift: any, source = "admin", sourceRef = "") {
  ensureGiftSchema();
  const playerId = Math.trunc(Number(playerIdRaw || 0));
  if (!playerId || !playerExists(playerId)) return err("Player not found.", "PLAYER_NOT_FOUND");
  const gift = validateGiftJson(rawGift);
  const grantId = cleanId(rawGift?.grantId || `${source}-${playerId}-${gift.itemId}-${now()}`);
  return giftMeasure.measure({
    start: () => `gift grant uid=${playerId} item=${gift.itemId}`,
    end: (r: any) => ({ ok: !!r?.ok, uid: playerId, item: gift.itemId, kind: gift.kind, reason: r?.reasonCode || null }),
    budget: 80,
    maxResultLength: 120,
  }, () => {
    try {
      rawRun(`insert into giftGrants (grantId, playerId, source, sourceRef, kind, itemId, label, giftJson, status, equipped, createdAt, claimedAt, adminNote)
        values (?, ?, ?, ?, ?, ?, ?, ?, 'granted', 0, ?, ?, ?)`, grantId, playerId, String(source || "admin").slice(0, 32), String(sourceRef || "").slice(0, 80), gift.kind, gift.itemId, gift.label, JSON.stringify(gift.giftJson), now(), now(), String(rawGift?.adminNote || admin?.name || "").slice(0, 240));
    } catch (e: any) {
      if (/unique/i.test(String(e?.message || ""))) return err("Gift was already granted.", "GIFT_DUPLICATE", { grantId });
      throw e;
    }
    rawRun(`insert or ignore into playerCosmetics (playerId, slot, itemId, label, sourceGrantId, equipped, createdAt)
      values (?, ?, ?, ?, ?, 0, ?)`, playerId, gift.slot, gift.itemId, gift.label, grantId, now());
    return ok({ grantId, playerId, gift: gift.giftJson, note: `${gift.label} granted.` });
  });
}

export function giftStatusForPlayer(p: any) {
  ensureGiftSchema();
  const playerId = Math.trunc(Number(p?.id || 0));
  if (!playerId) return err("auth", "AUTH");
  const grants = rawAll("select grantId,source,sourceRef,kind,itemId,label,giftJson,status,equipped,createdAt,claimedAt from giftGrants where playerId = ? order by createdAt desc limit 100", playerId)
    .map((r: any) => ({ ...r, gift: safeJson(r.giftJson, {}) }));
  const cosmetics = rawAll("select slot,itemId,label,sourceGrantId,equipped,createdAt from playerCosmetics where playerId = ? order by slot,createdAt desc", playerId);
  return ok({ grants, cosmetics });
}

export function equipCosmetic(p: any, slotRaw: any, itemIdRaw: any) {
  ensureGiftSchema();
  const playerId = Math.trunc(Number(p?.id || 0));
  const slot = cleanId(slotRaw);
  const itemId = cleanId(itemIdRaw);
  if (!playerId) return err("auth", "AUTH");
  if (!slot || !itemId) return err("Choose a cosmetic to equip.", "GIFT_INVALID_EQUIP");
  const row = rawGet("select * from playerCosmetics where playerId = ? and slot = ? and itemId = ?", playerId, slot, itemId);
  if (!row) return err("Cosmetic not found.", "GIFT_NOT_FOUND");
  rawRun("update playerCosmetics set equipped = 0 where playerId = ? and slot = ?", playerId, slot);
  rawRun("update playerCosmetics set equipped = 1 where playerId = ? and slot = ? and itemId = ?", playerId, slot, itemId);
  rawRun("update giftGrants set equipped = case when grantId = ? then 1 else equipped end where playerId = ?", String(row.sourceGrantId || ""), playerId);
  return ok({ slot, itemId, note: `${row.label || itemId} equipped.` });
}

export function adminGiftDashboard(filters: any = {}) {
  ensureGiftSchema();
  const playerId = Math.trunc(Number(filters.playerId || 0));
  const itemId = cleanId(filters.itemId || "");
  const limit = Math.max(1, Math.min(250, Number(filters.limit || 100) || 100));
  const where = playerId ? "where g.playerId = ?" : itemId ? "where g.itemId = ?" : "";
  const args = playerId ? [playerId] : itemId ? [itemId] : [];
  const grants = rawAll(`select g.*, p.name as playerName, p.wallet as wallet from giftGrants g left join players p on p.id = g.playerId ${where} order by g.createdAt desc limit ${limit}`, ...args)
    .map((r: any) => ({ ...r, gift: safeJson(r.giftJson, {}) }));
  return ok({ grants, totals: { grants: Number(rawGet("select count(*) as n from giftGrants")?.n || 0), cosmetics: Number(rawGet("select count(*) as n from playerCosmetics")?.n || 0) } });
}
