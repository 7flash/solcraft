// @ts-nocheck
import { createMeasure } from "measure-fn";
import { db } from "./db";

const referralMeasure = createMeasure("referrals", { maxResultLength: 160 });
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;
const MAX_REWARD = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_MAX_COIN_REWARD || 10000) || 10000);
const MAX_USES = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_MAX_USES || 250) || 250);
const DEFAULT_REWARD = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_DEFAULT_COIN_REWARD || 500) || 500);

export type ReferralRewardKind = "coins";
export type ReferralCreateInput = {
  code?: string;
  rewardKind?: ReferralRewardKind;
  rewardAmount?: number;
  maxUses?: number;
  note?: string;
  expiresAt?: number;
};
export type ReferralResult = { ok: boolean; msg?: string; reasonCode?: string; [key: string]: any };

function now() { return Date.now(); }
function err(msg: string, reasonCode = "REFERRAL_FAILED", extra: Record<string, any> = {}): ReferralResult { return { ok: false, msg, reasonCode, ...extra }; }
function ok(extra: Record<string, any> = {}): ReferralResult { return { ok: true, ...extra }; }
function rawGet(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.get(...args); }
function rawAll(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.all(...args); }
function rawRun(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.run(...args); }
function exec(sql: string) { return (db as any).exec?.(sql); }
function tx<T>(fn: () => T): T {
  exec("BEGIN IMMEDIATE");
  try { const out = fn(); exec("COMMIT"); return out; }
  catch (e) { try { exec("ROLLBACK"); } catch {} throw e; }
}
function safeJson<T>(value: any, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
}
function playerName(row: any) { return String(row?.name || `Player ${Number(row?.id || 0)}`).slice(0, 32); }
function parseInv(row: any) { return safeJson<Record<string, number>>(row?.inv, {}); }
function writeInv(playerId: number, inv: Record<string, any>) {
  const body = JSON.stringify(inv || {});
  try { rawRun("update players set inv = ?, updatedAt = ? where id = ?", body, now(), playerId); }
  catch { rawRun("update players set inv = ? where id = ?", body, playerId); }
}
function playerRow(playerId: any) {
  const id = Math.trunc(Number(playerId || 0));
  if (!id) return null;
  try { return rawGet("select id,name,wallet,inv,profileDone from players where id = ?", id) || null; } catch { return null; }
}
function coinsOf(row: any) { return Math.floor(Number(parseInv(row).g || 0)); }
function normalizeRewardAmount(value: any, fallback = DEFAULT_REWARD) {
  const n = Math.floor(Number(value ?? fallback) || fallback);
  return Math.max(1, Math.min(MAX_REWARD, n));
}
export function normalizeReferralCode(value: any) {
  const code = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]+/g, "")
    .slice(0, 32);
  return CODE_RE.test(code) ? code : "";
}
function randomCode(prefix = "SOL") {
  const bytes = crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(5)) : new Uint8Array(Array.from({ length: 5 }, () => Math.floor(Math.random() * 256)));
  const tail = Array.from(bytes).map((b) => (b % 36).toString(36).toUpperCase()).join("");
  return normalizeReferralCode(`${prefix}-${tail}`) || `SOL-${Math.floor(Math.random() * 1e8).toString(36).toUpperCase()}`;
}
function codePrefixForOwner(owner: any) {
  return String(owner?.name || "SOL").trim().replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 8) || "SOL";
}

export function ensureReferralSchema() {
  exec(`create table if not exists referralCodes (
    id integer primary key autoincrement,
    code text not null unique collate nocase,
    ownerPlayerId integer not null,
    rewardKind text not null default 'coins',
    rewardAmount integer not null default 0,
    maxUses integer not null default 1,
    uses integer not null default 0,
    active integer not null default 1,
    note text,
    giftJson text,
    createdAt integer not null,
    updatedAt integer not null,
    expiresAt integer
  )`);
  exec(`create table if not exists referralClaims (
    id integer primary key autoincrement,
    code text not null collate nocase,
    codeId integer not null,
    referrerPlayerId integer not null,
    refereePlayerId integer not null unique,
    rewardKind text not null default 'coins',
    rewardAmount integer not null default 0,
    status text not null default 'paid',
    message text,
    createdAt integer not null
  )`);
  exec("create index if not exists idx_referral_codes_owner ON referralCodes(ownerPlayerId, active, createdAt)");
  exec("create index if not exists idx_referral_codes_code ON referralCodes(code)");
  exec("create index if not exists idx_referral_claims_referrer ON referralClaims(referrerPlayerId, createdAt)");
  exec("create index if not exists idx_referral_claims_referee ON referralClaims(refereePlayerId)");
}

export function referralStatusForPlayer(p: any): ReferralResult {
  ensureReferralSchema();
  const playerId = Math.trunc(Number(p?.id || 0));
  if (!playerId) return err("auth", "AUTH");
  const codes = rawAll(`select id,code,rewardKind,rewardAmount,maxUses,uses,active,note,createdAt,updatedAt,expiresAt
    from referralCodes where ownerPlayerId = ? order by active desc, createdAt desc limit 50`, playerId);
  const claim = rawGet(`select c.id,c.code,c.referrerPlayerId,c.rewardKind,c.rewardAmount,c.status,c.message,c.createdAt,p.name as referrerName
    from referralClaims c left join players p on p.id = c.referrerPlayerId where c.refereePlayerId = ? order by c.id desc limit 1`, playerId) || null;
  const referred = rawAll(`select c.id,c.code,c.refereePlayerId,c.rewardKind,c.rewardAmount,c.status,c.createdAt,p.name as refereeName
    from referralClaims c left join players p on p.id = c.refereePlayerId where c.referrerPlayerId = ? order by c.createdAt desc limit 80`, playerId);
  return ok({ codes, claim, referred, defaults: { rewardKind: "coins", rewardAmount: DEFAULT_REWARD, maxReward: MAX_REWARD, maxUses: MAX_USES } });
}

export function createReferralCode(owner: any, input: ReferralCreateInput = {}): ReferralResult {
  ensureReferralSchema();
  const ownerId = Math.trunc(Number(owner?.id || 0));
  if (!ownerId) return err("auth", "AUTH");
  const ownerRow = playerRow(ownerId);
  if (!ownerRow) return err("Player not found.", "PLAYER_NOT_FOUND");
  const rewardKind = "coins";
  const rewardAmount = normalizeRewardAmount(input.rewardAmount);
  const maxUses = Math.max(1, Math.min(MAX_USES, Math.floor(Number(input.maxUses || 1) || 1)));
  const note = String(input.note || "").trim().slice(0, 160);
  const expiresAt = Number(input.expiresAt || 0) > now() ? Math.floor(Number(input.expiresAt)) : null;
  if (coinsOf(ownerRow) < rewardAmount) return err(`You need at least ${rewardAmount}🪙 to fund the first referral gift.`, "REFERRAL_NOT_FUNDED", { rewardAmount });

  let code = normalizeReferralCode(input.code);
  for (let i = 0; !code || rawGet("select id from referralCodes where code = ?", code); i++) {
    if (i > 12) return err("Could not generate a unique referral code. Try again.", "REFERRAL_CODE_COLLISION");
    code = randomCode(codePrefixForOwner(ownerRow));
  }
  rawRun(`insert into referralCodes (code, ownerPlayerId, rewardKind, rewardAmount, maxUses, uses, active, note, giftJson, createdAt, updatedAt, expiresAt)
    values (?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)`, code, ownerId, rewardKind, rewardAmount, maxUses, note, JSON.stringify({ kind: "coins", amount: rewardAmount }), now(), now(), expiresAt);
  const row = rawGet("select * from referralCodes where code = ?", code);
  return ok({ code: row, note: `Referral code ${code} created. New players receive ${rewardAmount}🪙 when they create their character.` });
}

export function deactivateReferralCode(owner: any, codeRaw: any): ReferralResult {
  ensureReferralSchema();
  const ownerId = Math.trunc(Number(owner?.id || 0));
  const code = normalizeReferralCode(codeRaw);
  if (!ownerId) return err("auth", "AUTH");
  if (!code) return err("Enter a valid referral code.", "REFERRAL_CODE_INVALID");
  const row = rawGet("select * from referralCodes where code = ?", code);
  if (!row || Number(row.ownerPlayerId || 0) !== ownerId) return err("Referral code not found.", "REFERRAL_CODE_NOT_FOUND");
  rawRun("update referralCodes set active = 0, updatedAt = ? where id = ?", now(), Number(row.id));
  return ok({ code, note: `Referral code ${code} is now paused.` });
}

export function applyReferralCodeForNewProfile(p: any, rawCode: any): ReferralResult | null {
  const code = normalizeReferralCode(rawCode);
  if (!code) return rawCode ? err("Referral code is not valid. Use letters, numbers, _ or -.", "REFERRAL_CODE_INVALID") : null;
  ensureReferralSchema();
  const refereeId = Math.trunc(Number(p?.id || 0));
  if (!refereeId) return err("auth", "AUTH");
  const referee = playerRow(refereeId);
  if (!referee) return err("Player not found.", "PLAYER_NOT_FOUND");
  if (Number(referee.profileDone || 0)) return err("Referral codes can only be used while creating your character.", "REFERRAL_ONLY_ON_CREATE");
  if (rawGet("select id from referralClaims where refereePlayerId = ?", refereeId)) return err("This character already used a referral code.", "REFERRAL_ALREADY_USED");

  const row = rawGet("select * from referralCodes where code = ?", code);
  if (!row || !Number(row.active || 0)) return err("Referral code was not found or is paused.", "REFERRAL_CODE_NOT_FOUND");
  if (row.expiresAt && Number(row.expiresAt) < now()) return err("Referral code expired.", "REFERRAL_CODE_EXPIRED");
  if (Number(row.ownerPlayerId || 0) === refereeId) return err("You cannot use your own referral code.", "REFERRAL_SELF");
  if (Number(row.maxUses || 0) > 0 && Number(row.uses || 0) >= Number(row.maxUses || 0)) return err("Referral code has no gifts left.", "REFERRAL_CODE_USED_UP");
  if (String(row.rewardKind || "coins") !== "coins") return err("Referral reward type is not supported yet.", "REFERRAL_REWARD_UNSUPPORTED");

  const referrer = playerRow(row.ownerPlayerId);
  if (!referrer) return err("Referral sponsor no longer exists.", "REFERRAL_SPONSOR_MISSING");
  const amount = normalizeRewardAmount(row.rewardAmount, 0);
  if (amount <= 0) return err("Referral gift is empty.", "REFERRAL_EMPTY_REWARD");
  if (coinsOf(referrer) < amount) return err(`Referral code is not funded right now. ${playerName(referrer)} needs ${amount}🪙 available.`, "REFERRAL_NOT_FUNDED", { code, rewardAmount: amount });

  return referralMeasure.measure({
    start: () => `claim referral code=${code} uid=${refereeId} ref=${Number(referrer.id)}`,
    end: (r: any) => ({ ok: !!r?.ok, uid: refereeId, ref: Number(referrer.id), code, amount, reason: r?.reasonCode || null }),
    budget: 80,
    maxResultLength: 140,
  }, () => tx(() => {
    const freshReferrer = playerRow(row.ownerPlayerId);
    const freshReferee = playerRow(refereeId);
    if (coinsOf(freshReferrer) < amount) return err("Referral sponsor no longer has enough coins.", "REFERRAL_NOT_FUNDED", { code, rewardAmount: amount });
    const sponsorInv = parseInv(freshReferrer); sponsorInv.g = Math.max(0, Math.floor(Number(sponsorInv.g || 0)) - amount);
    const refereeInv = parseInv(freshReferee); refereeInv.g = Math.max(0, Math.floor(Number(refereeInv.g || 0)) + amount);
    writeInv(Number(freshReferrer.id), sponsorInv);
    writeInv(Number(freshReferee.id), refereeInv);
    rawRun("update referralCodes set uses = uses + 1, updatedAt = ? where id = ?", now(), Number(row.id));
    const message = `${playerName(referrer)} gifted you ${amount}🪙 through referral code ${code}.`;
    rawRun(`insert into referralClaims (code, codeId, referrerPlayerId, refereePlayerId, rewardKind, rewardAmount, status, message, createdAt)
      values (?, ?, ?, ?, 'coins', ?, 'paid', ?, ?)`, code, Number(row.id), Number(referrer.id), refereeId, amount, message, now());
    return ok({ code, referrerId: Number(referrer.id), referrerName: playerName(referrer), rewardKind: "coins", rewardAmount: amount, note: message, toast: message });
  }));
}

export function referralTablesHealth() {
  ensureReferralSchema();
  return {
    codes: Number(rawGet("select count(*) as n from referralCodes")?.n || 0),
    activeCodes: Number(rawGet("select count(*) as n from referralCodes where active = 1")?.n || 0),
    claims: Number(rawGet("select count(*) as n from referralClaims")?.n || 0),
  };
}
