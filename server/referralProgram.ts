// @ts-nocheck
import { createHash, randomBytes } from "crypto";
import { createMeasure } from "measure-fn";
import { db } from "./db";

const referralMeasure = createMeasure("referrals", { maxResultLength: 140 });
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

const MAX_REWARD = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_MAX_COIN_REWARD || 10000) || 10000);
const MAX_USES = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_MAX_USES || 250) || 250);
const DEFAULT_REWARD = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_DEFAULT_COIN_REWARD || 500) || 500);
const MAX_ACTIVE_CODES = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_MAX_ACTIVE_CODES_PER_PLAYER || 10) || 10);
const MAX_DAILY_SPONSORED = Math.max(1, Number(process.env.SOLCRAFT_REFERRAL_MAX_DAILY_SPONSORED_COINS || 25000) || 25000);
const SAME_IP_WINDOW_MS = Math.max(0, Number(process.env.SOLCRAFT_REFERRAL_SAME_IP_WINDOW_MS || 86400000) || 86400000);
const SAME_IP_MAX_CLAIMS = Math.max(0, Number(process.env.SOLCRAFT_REFERRAL_SAME_IP_MAX_CLAIMS || 3) || 3);
const REQUIRE_SPONSOR_PROFILE = String(process.env.SOLCRAFT_REFERRAL_REQUIRE_SPONSOR_PROFILE_DONE || "1") !== "0";
const REQUIRE_SPONSOR_WALLET = String(process.env.SOLCRAFT_REFERRAL_REQUIRE_SPONSOR_WALLET || "0") === "1";

export type ReferralRewardKind = "coins";
export type ReferralCreateInput = {
  code?: string;
  rewardKind?: ReferralRewardKind;
  rewardAmount?: number;
  maxUses?: number;
  note?: string;
  expiresAt?: number;
};
export type ReferralClaimContext = { ip?: string; userAgent?: string; requestId?: string };
export type ReferralResult = { ok: boolean; msg?: string; reasonCode?: string; [key: string]: any };

function now() { return Date.now(); }
function dayAgo(t = now()) { return t - 24 * 60 * 60 * 1000; }
function err(msg: string, reasonCode = "REFERRAL_FAILED", extra: Record<string, any> = {}): ReferralResult { return { ok: false, msg, reasonCode, ...extra }; }
function ok(extra: Record<string, any> = {}): ReferralResult { return { ok: true, ...extra }; }
function rawGet(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.get(...args); }
function rawAll(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.all(...args); }
function rawRun(sql: string, ...args: any[]) { const q = (db as any).query?.(sql); if (!q) throw new Error("DB raw query API unavailable"); return q.run(...args); }
function exec(sql: string) { return (db as any).exec?.(sql); }
function tryExec(sql: string) { try { exec(sql); } catch {} }
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
  try { return rawGet("select id,name,wallet,inv,profileDone,lastSeen from players where id = ?", id) || null; } catch { return null; }
}
function coinsOf(row: any) { return Math.floor(Number(parseInv(row).g || 0)); }
function normalizeRewardAmount(value: any, fallback = DEFAULT_REWARD) {
  const n = Math.floor(Number(value ?? fallback) || fallback);
  return Math.max(1, Math.min(MAX_REWARD, n));
}
function hashIp(value: any) {
  const ip = String(value || "").trim();
  if (!ip) return "";
  const salt = String(process.env.SOLCRAFT_REFERRAL_IP_SALT || process.env.SOLCRAFT_ADMIN_KEY || "solcraft-referral");
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}
function cleanUa(value: any) { return String(value || "").slice(0, 180); }
function boolInt(v: any) { return Number(v || 0) ? 1 : 0; }

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
  const bytes = randomBytes(5);
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

  // Stage 53 hardening columns. ALTER is intentionally best-effort so existing dev DBs keep booting.
  tryExec("alter table referralCodes add column createdByAdmin integer not null default 0");
  tryExec("alter table referralCodes add column disabledByAdmin integer not null default 0");
  tryExec("alter table referralCodes add column adminNote text");
  tryExec("alter table referralCodes add column totalRewardPaid integer not null default 0");
  tryExec("alter table referralClaims add column ipHash text");
  tryExec("alter table referralClaims add column userAgent text");
  tryExec("alter table referralClaims add column requestId text");
  tryExec("alter table referralClaims add column extraJson text");

  exec(`create table if not exists referralAdminEvents (
    id integer primary key autoincrement,
    admin text,
    action text not null,
    code text,
    ownerPlayerId integer,
    targetPlayerId integer,
    amount integer,
    note text,
    createdAt integer not null
  )`);

  exec("create index if not exists idx_referral_codes_owner ON referralCodes(ownerPlayerId, active, createdAt)");
  exec("create index if not exists idx_referral_codes_code ON referralCodes(code)");
  exec("create index if not exists idx_referral_codes_admin ON referralCodes(disabledByAdmin, active, updatedAt)");
  exec("create index if not exists idx_referral_claims_referrer ON referralClaims(referrerPlayerId, createdAt)");
  exec("create index if not exists idx_referral_claims_referee ON referralClaims(refereePlayerId)");
  exec("create index if not exists idx_referral_claims_code ON referralClaims(code, createdAt)");
  exec("create index if not exists idx_referral_claims_ip ON referralClaims(ipHash, createdAt)");
  exec("create index if not exists idx_referral_admin_events ON referralAdminEvents(action, createdAt)");
}

function dailySponsoredBy(ownerPlayerId: number, t = now()) {
  ensureReferralSchema();
  const row = rawGet(`select coalesce(sum(rewardAmount),0) as n from referralClaims
    where referrerPlayerId = ? and status = 'paid' and createdAt >= ?`, ownerPlayerId, dayAgo(t));
  return Number(row?.n || 0) || 0;
}
function activeCodesBy(ownerPlayerId: number) {
  const row = rawGet(`select count(*) as n from referralCodes
    where ownerPlayerId = ? and active = 1 and coalesce(disabledByAdmin,0) = 0`, ownerPlayerId);
  return Number(row?.n || 0) || 0;
}
function validateSponsor(ownerRow: any) {
  if (!ownerRow) return err("Referral sponsor no longer exists.", "REFERRAL_SPONSOR_MISSING");
  if (REQUIRE_SPONSOR_PROFILE && !Number(ownerRow.profileDone || 0)) return err("Referral sponsor must finish their profile first.", "REFERRAL_SPONSOR_INCOMPLETE");
  if (REQUIRE_SPONSOR_WALLET && !String(ownerRow.wallet || "")) return err("Referral sponsor needs a connected wallet.", "REFERRAL_SPONSOR_WALLET_REQUIRED");
  return null;
}
function sameIpBlocked(ipHash: string, refereeId: number) {
  if (!ipHash || !SAME_IP_WINDOW_MS || !SAME_IP_MAX_CLAIMS) return false;
  const since = now() - SAME_IP_WINDOW_MS;
  const row = rawGet(`select count(*) as n from referralClaims where ipHash = ? and refereePlayerId != ? and createdAt >= ?`, ipHash, refereeId, since);
  return Number(row?.n || 0) >= SAME_IP_MAX_CLAIMS;
}

export function referralStatusForPlayer(p: any): ReferralResult {
  ensureReferralSchema();
  const playerId = Math.trunc(Number(p?.id || 0));
  if (!playerId) return err("auth", "AUTH");
  const codes = rawAll(`select id,code,rewardKind,rewardAmount,maxUses,uses,active,coalesce(disabledByAdmin,0) as disabledByAdmin,note,totalRewardPaid,createdAt,updatedAt,expiresAt
    from referralCodes where ownerPlayerId = ? order by active desc, createdAt desc limit 50`, playerId);
  const claim = rawGet(`select c.id,c.code,c.referrerPlayerId,c.rewardKind,c.rewardAmount,c.status,c.message,c.createdAt,p.name as referrerName
    from referralClaims c left join players p on p.id = c.referrerPlayerId where c.refereePlayerId = ? order by c.id desc limit 1`, playerId) || null;
  const referred = rawAll(`select c.id,c.code,c.refereePlayerId,c.rewardKind,c.rewardAmount,c.status,c.createdAt,p.name as refereeName
    from referralClaims c left join players p on p.id = c.refereePlayerId where c.referrerPlayerId = ? order by c.createdAt desc limit 80`, playerId);
  return ok({
    codes,
    claim,
    referred,
    stats: { activeCodes: activeCodesBy(playerId), sponsoredToday: dailySponsoredBy(playerId) },
    defaults: { rewardKind: "coins", rewardAmount: DEFAULT_REWARD, maxReward: MAX_REWARD, maxUses: MAX_USES, maxActiveCodes: MAX_ACTIVE_CODES, maxDailySponsored: MAX_DAILY_SPONSORED },
  });
}

export function createReferralCode(owner: any, input: ReferralCreateInput = {}): ReferralResult {
  ensureReferralSchema();
  const ownerId = Math.trunc(Number(owner?.id || 0));
  if (!ownerId) return err("auth", "AUTH");
  const ownerRow = playerRow(ownerId);
  const sponsorErr = validateSponsor(ownerRow);
  if (sponsorErr) return sponsorErr;
  if (activeCodesBy(ownerId) >= MAX_ACTIVE_CODES) return err(`You can have at most ${MAX_ACTIVE_CODES} active referral codes. Pause one first.`, "REFERRAL_TOO_MANY_ACTIVE_CODES", { maxActiveCodes: MAX_ACTIVE_CODES });

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

export function applyReferralCodeForNewProfile(p: any, rawCode: any, claimContext: ReferralClaimContext = {}): ReferralResult | null {
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
  if (!row || !Number(row.active || 0) || Number(row.disabledByAdmin || 0)) return err("Referral code was not found or is paused.", "REFERRAL_CODE_NOT_FOUND");
  if (row.expiresAt && Number(row.expiresAt) < now()) return err("Referral code expired.", "REFERRAL_CODE_EXPIRED");
  if (Number(row.ownerPlayerId || 0) === refereeId) return err("You cannot use your own referral code.", "REFERRAL_SELF");
  if (Number(row.maxUses || 0) > 0 && Number(row.uses || 0) >= Number(row.maxUses || 0)) return err("Referral code has no gifts left.", "REFERRAL_CODE_USED_UP");
  if (String(row.rewardKind || "coins") !== "coins") return err("Referral reward type is not supported yet.", "REFERRAL_REWARD_UNSUPPORTED");

  const referrer = playerRow(row.ownerPlayerId);
  const sponsorErr = validateSponsor(referrer);
  if (sponsorErr) return sponsorErr;
  const amount = normalizeRewardAmount(row.rewardAmount, 0);
  if (amount <= 0) return err("Referral gift is empty.", "REFERRAL_EMPTY_REWARD");
  if (dailySponsoredBy(Number(referrer.id)) + amount > MAX_DAILY_SPONSORED) return err("Referral sponsor has reached today's gift limit.", "REFERRAL_DAILY_LIMIT", { maxDailySponsored: MAX_DAILY_SPONSORED });
  if (coinsOf(referrer) < amount) return err(`Referral code is not funded right now. ${playerName(referrer)} needs ${amount}🪙 available.`, "REFERRAL_NOT_FUNDED", { code, rewardAmount: amount });
  const ipHash = hashIp(claimContext.ip);
  if (sameIpBlocked(ipHash, refereeId)) return err("Too many referral claims came from this network recently. Try later or use a different code.", "REFERRAL_IP_LIMIT");

  return referralMeasure.measure({
    start: () => `claim referral code=${code} uid=${refereeId} ref=${Number(referrer.id)}`,
    end: (r: any) => ({ ok: !!r?.ok, uid: refereeId, ref: Number(referrer.id), code, amount, reason: r?.reasonCode || null }),
    budget: 80,
    maxResultLength: 120,
  }, () => tx(() => {
    const freshReferrer = playerRow(row.ownerPlayerId);
    const freshReferee = playerRow(refereeId);
    const freshSponsorErr = validateSponsor(freshReferrer);
    if (freshSponsorErr) return freshSponsorErr;
    if (rawGet("select id from referralClaims where refereePlayerId = ?", refereeId)) return err("This character already used a referral code.", "REFERRAL_ALREADY_USED");
    if (dailySponsoredBy(Number(freshReferrer.id)) + amount > MAX_DAILY_SPONSORED) return err("Referral sponsor has reached today's gift limit.", "REFERRAL_DAILY_LIMIT", { maxDailySponsored: MAX_DAILY_SPONSORED });
    if (coinsOf(freshReferrer) < amount) return err("Referral sponsor no longer has enough coins.", "REFERRAL_NOT_FUNDED", { code, rewardAmount: amount });
    const sponsorInv = parseInv(freshReferrer); sponsorInv.g = Math.max(0, Math.floor(Number(sponsorInv.g || 0)) - amount);
    const refereeInv = parseInv(freshReferee); refereeInv.g = Math.max(0, Math.floor(Number(refereeInv.g || 0)) + amount);
    writeInv(Number(freshReferrer.id), sponsorInv);
    writeInv(Number(freshReferee.id), refereeInv);
    rawRun("update referralCodes set uses = uses + 1, totalRewardPaid = coalesce(totalRewardPaid,0) + ?, updatedAt = ? where id = ?", amount, now(), Number(row.id));
    const message = `${playerName(freshReferrer)} gifted you ${amount}🪙 through referral code ${code}.`;
    rawRun(`insert into referralClaims (code, codeId, referrerPlayerId, refereePlayerId, rewardKind, rewardAmount, status, message, createdAt, ipHash, userAgent, requestId, extraJson)
      values (?, ?, ?, ?, 'coins', ?, 'paid', ?, ?, ?, ?, ?, ?)`, code, Number(row.id), Number(freshReferrer.id), refereeId, amount, message, now(), ipHash || null, cleanUa(claimContext.userAgent) || null, String(claimContext.requestId || "").slice(0, 80) || null, JSON.stringify({ source: "profile-create" }));
    return ok({ code, referrerId: Number(freshReferrer.id), referrerName: playerName(freshReferrer), rewardKind: "coins", rewardAmount: amount, note: message, toast: message });
  }));
}

export function referralTablesHealth() {
  ensureReferralSchema();
  return {
    codes: Number(rawGet("select count(*) as n from referralCodes")?.n || 0),
    activeCodes: Number(rawGet("select count(*) as n from referralCodes where active = 1 and coalesce(disabledByAdmin,0) = 0")?.n || 0),
    claims: Number(rawGet("select count(*) as n from referralClaims")?.n || 0),
    totalPaid: Number(rawGet("select coalesce(sum(rewardAmount),0) as n from referralClaims where status = 'paid'")?.n || 0),
  };
}

export function adminReferralDashboard(filters: any = {}) {
  ensureReferralSchema();
  const code = normalizeReferralCode(filters.code);
  const ownerId = Math.trunc(Number(filters.ownerPlayerId || filters.referrerPlayerId || 0));
  const limit = Math.max(1, Math.min(250, Number(filters.limit || 100) || 100));
  const codeWhere = code ? "where c.code = ?" : ownerId ? "where c.ownerPlayerId = ?" : "";
  const codeArgs = code ? [code] : ownerId ? [ownerId] : [];
  const codes = rawAll(`select c.*, p.name as ownerName, p.wallet as ownerWallet from referralCodes c left join players p on p.id = c.ownerPlayerId ${codeWhere} order by c.updatedAt desc limit ${limit}`, ...codeArgs);
  const claimWhere = code ? "where cl.code = ?" : ownerId ? "where cl.referrerPlayerId = ?" : "";
  const claimArgs = code ? [code] : ownerId ? [ownerId] : [];
  const claims = rawAll(`select cl.*, rp.name as referrerName, np.name as refereeName from referralClaims cl
    left join players rp on rp.id = cl.referrerPlayerId left join players np on np.id = cl.refereePlayerId ${claimWhere} order by cl.createdAt desc limit ${limit}`, ...claimArgs);
  return ok({ codes, claims, health: referralTablesHealth(), limits: { maxReward: MAX_REWARD, maxUses: MAX_USES, maxActiveCodes: MAX_ACTIVE_CODES, maxDailySponsored: MAX_DAILY_SPONSORED, sameIpMaxClaims: SAME_IP_MAX_CLAIMS, sameIpWindowMs: SAME_IP_WINDOW_MS } });
}

export function adminSetReferralCodeState(admin: any, input: any = {}) {
  ensureReferralSchema();
  const code = normalizeReferralCode(input.code);
  if (!code) return err("Referral code is required.", "REFERRAL_CODE_INVALID");
  const row = rawGet("select * from referralCodes where code = ?", code);
  if (!row) return err("Referral code not found.", "REFERRAL_CODE_NOT_FOUND");
  const active = input.active === undefined ? Number(row.active || 0) : boolInt(input.active);
  const disabledByAdmin = input.disabledByAdmin === undefined ? Number(row.disabledByAdmin || 0) : boolInt(input.disabledByAdmin);
  const rewardAmount = input.rewardAmount === undefined ? Number(row.rewardAmount || 0) : normalizeRewardAmount(input.rewardAmount, Number(row.rewardAmount || DEFAULT_REWARD));
  const maxUses = input.maxUses === undefined ? Number(row.maxUses || 0) : Math.max(1, Math.min(MAX_USES, Math.floor(Number(input.maxUses || 1) || 1)));
  const adminNote = String(input.adminNote || input.note || "").slice(0, 240);
  rawRun("update referralCodes set active = ?, disabledByAdmin = ?, rewardAmount = ?, maxUses = ?, adminNote = ?, updatedAt = ? where id = ?", active, disabledByAdmin, rewardAmount, maxUses, adminNote, now(), Number(row.id));
  rawRun("insert into referralAdminEvents (admin, action, code, ownerPlayerId, amount, note, createdAt) values (?, ?, ?, ?, ?, ?, ?)", String(admin?.name || admin?.key || "admin").slice(0, 80), disabledByAdmin ? "disable" : active ? "update" : "pause", code, Number(row.ownerPlayerId), rewardAmount, adminNote, now());
  return ok({ code, note: `Referral code ${code} updated.` });
}

export function adminCreateReferralCode(admin: any, input: any = {}) {
  ensureReferralSchema();
  const ownerId = Math.trunc(Number(input.ownerPlayerId || input.playerId || 0));
  if (!ownerId) return err("ownerPlayerId is required.", "REFERRAL_OWNER_REQUIRED");
  const owner = playerRow(ownerId);
  if (!owner) return err("Owner player not found.", "PLAYER_NOT_FOUND");
  const result = createReferralCode(owner, input);
  if (result.ok && result.code?.code) {
    rawRun("update referralCodes set createdByAdmin = 1, adminNote = ? where code = ?", String(input.adminNote || input.note || "").slice(0, 240), result.code.code);
    rawRun("insert into referralAdminEvents (admin, action, code, ownerPlayerId, amount, note, createdAt) values (?, 'create', ?, ?, ?, ?, ?)", String(admin?.name || admin?.key || "admin").slice(0, 80), result.code.code, ownerId, Number(result.code.rewardAmount || 0), String(input.adminNote || input.note || "").slice(0, 240), now());
  }
  return result;
}
