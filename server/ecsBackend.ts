import { db, metaGet, metaSet } from "./db";
import { getPlayer, insertPlayer, playerByWallet, touchPlayerSeen, refreshPlayer } from "./playerStore";
import { checkWalletLoginGate } from "./login-gate";
import { verifyWalletAuth } from "./wallet-auth";
import { dispatchEcs, ecsContext, type EcsAction, type EcsWorld } from "./ecs/index";
import { loadEcsWorld, persistEcsWorldDelta, ecsRulesFromShared, ecsWorldRev, bumpEcsWorldRev, mirrorLegacyToEcsTables, ecsMigrationStatus } from "./ecsDbAdapter";
import { ECONOMY_RULES, PACK_SIZE, BASE_MAX, MAX_HP, RES_KEYS, biomeAt } from "./shared";
import { reputationSummaryForWire, tileCapacityForPlayer, storageCapsForPlayer } from "./reputationRules";
import { cleanEconomyTick, cleanEconomyStatus, cleanPlayerEconomySummary } from "./cleanEconomy";
import { dispatchEcsGameplayAction, ecsGameplayStatus, ecsGameplaySupportedActionTypes } from "./ecsGameplayActions";
import { activeActionSurface, removedFeatureResponse } from "./removedFeatures";
import { cleanBuildKindResponse } from "./cleanRelease";
import { recordActivity, logError } from "./activityLog";
import { withImmediateTx } from "./dbTx";
import { applyReferralCodeForNewProfile } from "./referralProgram";

export type EcsPlayerRow = any;
export type WalletAuthInput = { wallet?: string; message?: string; signature?: string } | null | undefined;

const AUTH_TOUCH_MS = 12_000;
const ACTIVE_PLAYER_WINDOW_MS = ECONOMY_RULES.activeWindowMs;
const VIEW_RADIUS = 26;
const ANCHOR_STEP = 6;
const ANCHOR_PAD = 8;
const CHAT_LIMIT = 40;
const MAX_WIRE_PLAYERS = 80;

let ecsTickStarted = false;
let ecsTickTimer: any = null;
let ecsTickAt = 0;
let requiredClientVersion = "";
let requiredClientReason = "";

function now() { return Date.now(); }
function key(x: number, z: number) { return `${x | 0},${z | 0}`; }
function cheb(x: number, z: number, x2: number, z2: number) { return Math.max(Math.abs((x | 0) - (x2 | 0)), Math.abs((z | 0) - (z2 | 0))); }
function anchorOf(x: number, z: number) { return [Math.floor((x | 0) / ANCHOR_STEP) * ANCHOR_STEP, Math.floor((z | 0) / ANCHOR_STEP) * ANCHOR_STEP] as const; }
function safeJson(raw: any, fallback: any) { try { return typeof raw === "string" ? JSON.parse(raw || "") : raw ?? fallback; } catch { return fallback; } }
function wonderMetaKey(uid: number) { return `wonder:recipe:${Number(uid) || 0}`; }
function readWonderRecipe(uid: number) { return safeJson(metaGet(wonderMetaKey(uid), "{}"), {}); }
function cleanName(name: string, fallback = "Wanderer") { return String(name || fallback).trim().slice(0, 18) || fallback; }
function randomSecret(prefix = "") { return `${prefix}${crypto.randomUUID()}`; }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function applyInviteCharacterGift(row: any, referral: any) {
  if (!row || !referral?.ok) return;
  if (referral.appearance && typeof referral.appearance === "object") row.appearance = JSON.stringify(referral.appearance).slice(0, 12000);
  if (Number.isFinite(Number(referral.body)) && Number(referral.body) > 0) row.body = Number(referral.body);
  if (Number.isFinite(Number(referral.hat)) && Number(referral.hat) > 0) row.hat = Number(referral.hat);
}
function isSpectator(p: any) { return String(p?.secret || "").startsWith("spectator:"); }
function pinfo(id: number) { const p = getPlayer(id) as any; return { name: p?.name || "Neutral", body: p?.body || 0x808080, hat: p?.hat || 0x111111 }; }
function bodyPalette(seed: number) { const colors = [0x6a5ae0, 0x14f195, 0xffc857, 0xff5c7a, 0x7dcfe8, 0x9945ff]; return { body: colors[Math.abs(seed) % colors.length], hat: colors[(Math.abs(seed) + 2) % colors.length] }; }
function spawnOrigin(idx: number) {
  const n = Math.max(0, Math.trunc(Number(idx) || 0));
  const ring = Math.floor(n / 8) + 1;
  const slot = n % 8;
  const radius = 22 + ring * 8;
  const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]] as const;
  const [dx, dz] = dirs[slot];
  return [dx * radius + (ring % 3) * 2, dz * radius - (ring % 2) * 2] as const;
}
function repairProfileSpawn(row: any) {
  if (!row) return;
  const x = Math.trunc(Number(row.x || 0));
  const z = Math.trunc(Number(row.z || 0));
  const sx = Math.trunc(Number(row.spawnX || 0));
  const sz = Math.trunc(Number(row.spawnZ || 0));
  if (Math.max(Math.abs(x), Math.abs(z)) <= 8 && Math.max(Math.abs(sx), Math.abs(sz)) > 8) { row.x = sx; row.z = sz; }
  row.inv = { w: 0, p: 0, s: 0, f: 0, g: Number(row.inv?.g || 0), sh: 0, sc: 0 };
}
function spectatorSpawnPoint(idx: number) { return [Math.cos(idx) * 6 | 0, Math.sin(idx) * 6 | 0] as const; }
function maxResourceBag(inv: any) { const out: any = {}; for (const k of RES_KEYS) out[k] = Math.max(0, Number(inv?.[k] || 0)); return out; }
function tileCapacityFor(p: any) { return tileCapacityForPlayer(p); }
function resourceCaps(p: any) { return storageCapsForPlayer(p); }
function energyNowForWire(p: any) {
  const maxE = Math.max(1, Number(BASE_MAX || 100));
  const regen = Math.max(0, Number(ECONOMY_RULES.energyRegenBasePerMinute || 0) / 60);
  const base = Math.max(0, Number(p?.energy ?? maxE));
  const at = Number(p?.energyAt || now());
  const dt = Math.max(0, Math.min(60, (now() - at) / 1000));
  return { energy: Math.max(0, Math.min(maxE, base + regen * dt)), maxE, regen };
}
function ownedTileCount(id: number) { return Number(db.tiles.select().where({ owner: id }).count() || 0); }
function nonBombBuildingCount(id: number) { return Number((db.buildings.select().where({ owner: id }).all() as any[]).filter((b) => !String(b.kind || "").includes("bomb")).length); }
function leaderboardRows() {
  return (db.players.select().all() as any[])
    .filter((p) => !isSpectator(p))
    .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0) || Number(b.level || 0) - Number(a.level || 0))
    .slice(0, 20)
    .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, level: p.level || 1, xp: p.xp || 0, body: p.body, hat: p.hat }));
}
function activeMapPlayers(t = now()) {
  return (db.players.select().all() as any[])
    .filter((p) => t - Number(p.lastSeen || 0) <= ACTIVE_PLAYER_WINDOW_MS)
    .map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, body: p.body, level: p.level || 1, spectator: isSpectator(p), lastSeen: p.lastSeen || 0 }));
}
function drainEcsEvents(world: EcsWorld, playerId: number) {
  return world.events
    .filter((e: any) => !e.entity || Number(e.entity) === playerId)
    .slice(-20)
    .map((e: any) => ({ kind: String(e.type || "info"), msg: eventText(e), ts: Number(e.t || now()) }));
}
function eventText(e: any) {
  const type = String(e?.type || "info");
  const d = e?.data || {};
  if (type === "move") return `Moved to ${d.x},${d.z}.`;
  if (type === "claim") return `Claimed ${d.x},${d.z}.`;
  if (type === "place") return `Construction started.`;
  if (type === "upgrade") return `Building upgraded.`;
  if (type === "demolish") return `Building demolished.`;
  if (type === "harvest") return `Gathered resources.`;
  return type;
}
function normalizeWalletAuth(input: WalletAuthInput) {
  const wallet = String((input as any)?.wallet || "").trim();
  const message = String((input as any)?.message || "");
  const signature = String((input as any)?.signature || "");
  return { wallet, message, signature };
}
async function verifyWalletLogin(input: WalletAuthInput) {
  const wa = normalizeWalletAuth(input);
  if (!wa.wallet || !wa.message || !wa.signature) throw Object.assign(new Error("Connect and sign with Phantom first."), { reasonCode: "WALLET_AUTH_REQUIRED" });
  const wallet = verifyWalletAuth(wa as any);
  const gate = await checkWalletLoginGate(wallet);
  if (!gate?.ok) throw Object.assign(new Error(gate?.msg || "Wallet does not meet token gate requirements."), { reasonCode: gate?.reasonCode || "TOKEN_GATE" });
  return { wallet, loginGate: gate.loginGate || gate };
}
function syncEcsPlayerEntity(p: any) {
  try {
    const existing = (db as any).ecsEntities?.select?.().where?.({ legacyTable: "players", legacyId: p.id })?.first?.();
    if (existing) { existing.kind = "player"; existing.active = 1; }
    else (db as any).ecsEntities?.insert?.({ kind: "player", legacyTable: "players", legacyId: p.id, active: 1 });
  } catch {}
}

export function auth(pid: number, secret: string): EcsPlayerRow | null {
  const p = getPlayer(Number(pid || 0)) as any;
  if (!p || String(p.secret || "") !== String(secret || "")) return null;
  touchPlayerSeen(p, now(), AUTH_TOUCH_MS);
  syncEcsPlayerEntity(p);
  return p;
}

export async function join(name: string, body: number, hat: number, walletAuth: WalletAuthInput, appearance?: any, referralCode?: any) {
  const { wallet, loginGate } = await verifyWalletLogin(walletAuth);
  const existing = playerByWallet(wallet) as any;
  const secret = randomSecret();
  if (existing) {
    existing.secret = secret;
    existing.lastSeen = now();
    if (!existing.profileDone && cleanName(name, "")) {
      existing.name = cleanName(name);
      existing.body = Number(body) || existing.body;
      existing.hat = Number(hat) || existing.hat;
      if (appearance !== undefined) existing.appearance = JSON.stringify(appearance).slice(0, 12000);
      const referral = applyReferralCodeForNewProfile(existing, referralCode, { requestId: "join-existing" });
      if (referral && !referral.ok) throw Object.assign(new Error(referral.msg || "Invite code could not be used."), { reasonCode: referral.reasonCode });
      if (referral?.ok && Number(referral.rewardAmount || 0) > 0) existing.inv = { ...(existing.inv || {}), g: Math.max(0, Number(existing.inv?.g || 0) + Number(referral.rewardAmount || 0)) };
      applyInviteCharacterGift(existing, referral);
      existing.profileDone = 1;
    }
    refreshPlayer(existing);
    syncEcsPlayerEntity(existing);
    mirrorLegacyToEcsTables("join-existing");
    return { id: existing.id, secret, wallet, existing: true, needsProfile: !existing.profileDone, loginGate, backend: "ecs" };
  }
  const idx = Number(metaGet("spawnIndex", "0")) || 0;
  const [ox, oz] = spawnOrigin(idx);
  metaSet("spawnIndex", String(idx + 1));
  const pal = bodyPalette(idx + 1);
  const hasName = cleanName(name, "").length > 0;
  const p = insertPlayer({
    name: hasName ? cleanName(name) : "Wanderer",
    secret,
    body: Number(body) || pal.body,
    hat: Number(hat) || pal.hat,
    x: ox, z: oz, spawnX: ox, spawnZ: oz,
    hp: MAX_HP, energy: BASE_MAX, energyAt: now(),
    wallet,
    faceImage: null,
    appearance: appearance ? JSON.stringify(appearance).slice(0, 12000) : null,
    tokenBalance: 0,
    vault: 0,
    strongbox: 0,
    inv: { w: 0, p: 0, s: 0, f: 0, g: 0, sh: 0, sc: 0 },
    pack: Array(PACK_SIZE).fill(null),
    equip: { hat: null, cape: null, armor: null, hand: null, boots: null },
    xp: 0, level: 1, skillPts: 0, skills: {},
    treesChopped: 0, planksMade: 0, gearCrafted: 0, tradesDone: 0, equippedOnce: 0, msIndex: 0,
    lastSeen: now(), profileDone: 0,
  }) as any;
  if (hasName) {
    const referral = applyReferralCodeForNewProfile(p, referralCode, { requestId: "join-new" });
    if (referral && !referral.ok) throw Object.assign(new Error(referral.msg || "Invite code could not be used."), { reasonCode: referral.reasonCode });
    if (referral?.ok && Number(referral.rewardAmount || 0) > 0) p.inv = { ...(p.inv || {}), g: Math.max(0, Number(p.inv?.g || 0) + Number(referral.rewardAmount || 0)) };
    applyInviteCharacterGift(p, referral);
    p.profileDone = 1;
    refreshPlayer(p);
  }
  // Fresh clean release: no automatic preclaimed base. First claim can be any free non-capital tile.
  syncEcsPlayerEntity(p);
  bumpEcsWorldRev();
  mirrorLegacyToEcsTables("join-new");
  return { id: p.id, secret, wallet, existing: false, needsProfile: !p.profileDone, spawnX: ox, spawnZ: oz, homeX: ox, homeZ: oz, loginGate, backend: "ecs" };
}

export function joinSpectator(name = "Spectator", appearance?: any) {
  const idx = Number(metaGet("spectatorIndex", "0")) || 0;
  metaSet("spectatorIndex", String(idx + 1));
  const [ox, oz] = spectatorSpawnPoint(idx);
  const pal = bodyPalette(idx + 1000);
  const p = insertPlayer({
    name: cleanName(name, "Spectator"), secret: randomSecret("spectator:"), body: pal.body, hat: pal.hat,
    x: ox, z: oz, spawnX: ox, spawnZ: oz, hp: MAX_HP, energy: BASE_MAX, energyAt: now(), wallet: null,
    faceImage: null, appearance: appearance ? JSON.stringify(appearance).slice(0, 12000) : null, tokenBalance: 0, vault: 0, strongbox: 0,
    inv: { w: 0, p: 0, s: 0, f: 0, g: 0, sh: 0, sc: 0 }, pack: Array(PACK_SIZE).fill(null), equip: {},
    xp: 0, level: 1, skillPts: 0, skills: {}, treesChopped: 0, planksMade: 0, gearCrafted: 0, tradesDone: 0, equippedOnce: 0, msIndex: 0,
    lastSeen: now(), profileDone: 1,
  }) as any;
  syncEcsPlayerEntity(p);
  return { id: p.id, secret: p.secret, wallet: "", existing: false, needsProfile: false, spectator: true, backend: "ecs" };
}

function worldRows(p: any, q: any, world: EcsWorld) {
  const [ax, az] = anchorOf(p.x, p.z);
  const R = VIEW_RADIUS + ANCHOR_PAD;
  const includeMap = Number(q.mapRev || 0) !== ecsWorldRev();
  const near = (r: any) => cheb(r.x, r.z, ax, az) <= R;
  const tiles = (db.tiles.select().all() as any[]).filter(near);
  const buildings = (db.buildings.select().all() as any[]).filter(near);
  const doodads = (db.doodads.select().all() as any[]).filter(near);
  const loot = (db.loot.select().all() as any[]).filter(near);
  return {
    rev: ecsWorldRev(), ax, az,
    tiles: tiles.map((r) => ({ x: r.x, z: r.z, owner: r.owner, ownerBody: pinfo(r.owner).body, ownerName: pinfo(r.owner).name })),
    buildings: buildings.map((b) => ({ uid: b.id, owner: b.owner, ownerName: pinfo(b.owner).name, ownerBody: pinfo(b.owner).body, ownerFace: null, kind: b.kind, x: b.x, z: b.z, nm: b.nm, cl: b.cl, acc: b.acc, accAt: b.accAt, cdUntil: b.cdUntil, constructAt: b.accAt, constructUntil: b.cdUntil, usedAt: b.usedAt || 0, level: b.level || 1, hp: b.hp, maxHp: b.maxHp, stored: b.stored || 0, wonder: b.kind === "worldwonder" ? readWonderRecipe(Number(b.id)) : null })),
    doodads: doodads.map((d) => ({ x: d.x, z: d.z, type: d.state === "gone" ? "gone" : d.state === "rock" ? "rock" : d.state === "food" ? "food" : "tree" })),
    loot: loot.map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, gid: l.gid })),
    offers: (db.offers.select().where({ open: 1 }).orderBy("id", "DESC").limit(20).all() as any[]).map((o) => ({ id: o.id, byId: o.byId, byName: o.byName, gRes: o.gRes, gAmt: o.gAmt, wRes: o.wRes, wAmt: o.wAmt })),
    coinNodes: [],
    map: includeMap ? {
      rev: ecsWorldRev(),
      tiles: (db.tiles.select().all() as any[]).map((r) => ({ x: r.x, z: r.z, owner: r.owner, ownerBody: pinfo(r.owner).body, ownerName: pinfo(r.owner).name })),
      buildings: (db.buildings.select().all() as any[]).map((b) => ({ uid: b.id, owner: b.owner, ownerBody: pinfo(b.owner).body, kind: b.kind, x: b.x, z: b.z })),
      loot: (db.loot.select().where({ kind: "gold" }).all() as any[]).map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, gid: l.gid })),
      players: activeMapPlayers(),
    } : undefined,
  };
}

export function snapshot(p: EcsPlayerRow, q: { rev: number; ax: number; az: number; chat: number; mapRev?: number }) {
  const t = now();
  const fresh = getPlayer(p.id) as any || p;
  const world = loadEcsWorld({ playerId: fresh.id, ax: q.ax, az: q.az, radius: VIEW_RADIUS + ANCHOR_PAD });
  const [ax, az] = anchorOf(fresh.x, fresh.z);
  const worldSame = q.rev === ecsWorldRev() && q.ax === ax && q.az === az && Number(q.mapRev || 0) === ecsWorldRev();
  const ownedBuildings = (db.buildings.select().where({ owner: fresh.id }).all() as any[]);
  const energyWire = energyNowForWire(fresh);
  const houses = ownedBuildings.filter((b) => String(b.kind || "") === "cottage" || String(b.kind || "") === "house").map((b) => ({ uid: Number(b.id), x: Number(b.x), z: Number(b.z), name: b.nm || "House" }));
  const wonders = ownedBuildings.filter((b) => String(b.kind || "") === "worldwonder").map((b) => ({ uid: Number(b.id), x: Number(b.x), z: Number(b.z), name: b.nm || "World Wonder" }));
  const me = {
    id: fresh.id, name: fresh.name, body: fresh.body, hat: fresh.hat, x: fresh.x, z: fresh.z, spawnX: fresh.spawnX, spawnZ: fresh.spawnZ,
    appearance: safeJson(fresh.appearance, null), energy: energyWire.energy, maxE: energyWire.maxE, regen: energyWire.regen, hp: fresh.hp ?? MAX_HP,
    wallet: fresh.wallet || null, tokenBalance: fresh.tokenBalance || 0, strongbox: fresh.strongbox || 0, vaultGold: fresh.vault || 0, biome: biomeAt(fresh.x, fresh.z).name,
    wonders, houses, inv: maxResourceBag(fresh.inv), pack: fresh.pack || [], equip: fresh.equip || {}, scienceCap: resourceCaps(fresh).sc,
    xp: fresh.xp || 0, level: fresh.level || 1, skillPts: fresh.skillPts || 0, skills: fresh.skills || {}, skillXp: {},
    territory: ownedTileCount(fresh.id), built: nonBombBuildingCount(fresh.id), msIndex: fresh.msIndex || 0,
    treesChopped: fresh.treesChopped || 0, planksMade: fresh.planksMade || 0, gearCrafted: fresh.gearCrafted || 0, tradesDone: fresh.tradesDone || 0, equippedOnce: !!fresh.equippedOnce,
    clientVersion: "", requiredVersion: requiredClientVersion, updateReason: requiredClientReason, profileDone: !!fresh.profileDone, spectator: isSpectator(fresh),
    tileCap: tileCapacityFor(fresh), storageCap: resourceCaps(fresh), tuning: {}, quests: {}, reputation: reputationSummaryForWire(fresh.id), guideQuests: [], guideSummary: { done: 0, total: 0, claimed: 0, claimable: 0, pct: 0 }, bank: null,
    backend: "ecs",
  };
  const players = (db.players.select().all() as any[])
    .filter((o) => o.id !== fresh.id && t - Number(o.lastSeen || 0) <= ACTIVE_PLAYER_WINDOW_MS && cheb(o.x, o.z, fresh.x, fresh.z) <= VIEW_RADIUS)
    .sort((a, b) => cheb(a.x, a.z, fresh.x, fresh.z) - cheb(b.x, b.z, fresh.x, fresh.z))
    .slice(0, MAX_WIRE_PLAYERS)
    .map((o) => ({ id: o.id, name: isSpectator(o) ? (o.name || "Spectator") : o.name, body: o.body, hat: o.hat, x: o.x, z: o.z, hp: o.hp, equip: isSpectator(o) ? {} : o.equip, appearance: isSpectator(o) ? null : o.appearance, level: o.level || 1, xp: o.xp || 0, spectator: isSpectator(o), ts: o.lastSeen, lastSeen: o.lastSeen }));
  const chat = (db.chat.select().orderBy("id", "DESC").limit(CHAT_LIMIT).all() as any[]).reverse().filter((c) => Number(c.id || 0) > Number(q.chat || 0));
  const base: any = { now: t, me, players, mapPlayers: activeMapPlayers(t), chat, events: drainEcsEvents(world, fresh.id), leaderboard: leaderboardRows(), requiredVersion: requiredClientVersion, updateReason: requiredClientReason };
  if (!worldSame) base.world = worldRows(fresh, q, world);
  return base;
}

function logEcsAction(player: number, action: string, result: any, backend = "ecs") {
  try {
    (db as any).ecsActionLog?.insert?.({ player: Number(player || 0), action: String(action || "").slice(0, 64), ok: result?.ok === false ? 0 : 1, reasonCode: result?.reasonCode || null, backend });
  } catch {}
}

const ECS_ACTION_TYPES = new Set(["move", "movePath", "claim", "place", "upgrade", "demolish", "harvest", "harvestStart", "harvestFinish", "pickup"]);

function cloneWorld(world: EcsWorld): EcsWorld {
  return typeof structuredClone === "function" ? structuredClone(world) : loadEcsWorld({ includeAll: true });
}

function dispatchUnlocked(p: EcsPlayerRow, body: any) {
  const type = String(body?.type || "");
  const removed = removedFeatureResponse(type);
  if (removed) { logEcsAction(Number(p?.id || 0), type, removed, "ecs-removed"); return { ...removed, backend: "ecs" }; }
  if (type === "chat") {
    const msg = String(body.msg || "").trim().slice(0, 180);
    if (!msg) return { ok: false, msg: "Write a message first.", reasonCode: "EMPTY_CHAT" };
    db.chat.insert({ name: p.name || "Settler", msg, sys: 0 });
    return { ok: true, backend: "ecs" };
  }
  if (type === "setupProfile") {
    const row = getPlayer(p.id) as any;
    if (!row) return { ok: false, msg: "Unknown player", reasonCode: "PLAYER_NOT_FOUND" };
    row.name = cleanName(String(body.name || row.name));
    row.body = Number(body.body) || row.body;
    row.hat = Number(body.hat) || row.hat;
    repairProfileSpawn(row);
    if (body.appearance !== undefined) row.appearance = JSON.stringify(body.appearance).slice(0, 12000);
    const referral = applyReferralCodeForNewProfile(row, body.referralCode, { requestId: String(body.rid || "") });
    if (referral && !referral.ok) return { ...referral, backend: "ecs" };
    if (referral?.ok && Number(referral.rewardAmount || 0) > 0) {
      row.inv = { ...(row.inv || {}), g: Math.max(0, Number(row.inv?.g || 0) + Number(referral.rewardAmount || 0)) };
    }
    applyInviteCharacterGift(row, referral);
    row.profileDone = 1;
    refreshPlayer(row);
    try { db.chat.insert({ name: "", msg: `${row.name || "A new settler"} joined the world.`, sys: 1 }); } catch {}
    return { ok: true, backend: "ecs", referral: referral || null, note: referral?.note || "Character ready." };
  }
  if (type === "profileAppearance") {
    const row = getPlayer(p.id) as any;
    if (!row) return { ok: false, msg: "Unknown player", reasonCode: "PLAYER_NOT_FOUND" };
    row.appearance = body.appearance == null ? null : JSON.stringify(body.appearance).slice(0, 12000);
    refreshPlayer(row);
    return { ok: true, backend: "ecs" };
  }
  if (type === "profileFace") {
    const row = getPlayer(p.id) as any;
    if (!row) return { ok: false, msg: "Unknown player", reasonCode: "PLAYER_NOT_FOUND" };
    row.faceImage = body.faceImage == null ? null : String(body.faceImage).slice(0, 220000);
    refreshPlayer(row);
    return { ok: true, backend: "ecs" };
  }
  const fresh = getPlayer(p.id) as any;
  if (!fresh) { const r = { ok: false, msg: "Unknown player", reasonCode: "PLAYER_NOT_FOUND" }; logEcsAction(p.id, type, r); return r; }
  if (isSpectator(fresh) && !["move", "movePath", "profileAppearance", "setupProfile"].includes(type)) { const r = { ok: false, msg: "Spectators cannot affect the world.", reasonCode: "SPECTATOR" }; logEcsAction(fresh.id, type, r); return r; }
  const gameplay = dispatchEcsGameplayAction(fresh, body);
  if (gameplay.handled) {
    const out = { ...(gameplay.result || { ok: false, msg: "ECS gameplay failed", reasonCode: "ECS_GAMEPLAY_FAILED" }), backend: "ecs" };
    logEcsAction(fresh.id, type, out, "ecs-gameplay");
    return out;
  }
  if (type === "place") {
    const blocked = cleanBuildKindResponse(body.kind);
    if (blocked) { logEcsAction(fresh.id, type, blocked, "ecs-clean-build"); return { ...blocked, backend: "ecs" }; }
  }
  if (!ECS_ACTION_TYPES.has(type)) { const r = { ok: false, msg: `ECS backend does not implement action: ${type}`, reasonCode: "ECS_ACTION_NOT_IMPLEMENTED", details: { type, gameplaySupported: ecsGameplaySupportedActionTypes() } }; logEcsAction(p.id, type, r); return r; }
  const before = loadEcsWorld({ playerId: fresh.id, ax: body.x ?? fresh.x, az: body.z ?? fresh.z, radius: 96 });
  const after = cloneWorld(before);
  const action: EcsAction = body;
  const result = dispatchEcs(after, fresh.id, action, ecsContext(now(), ecsRulesFromShared()));
  if (!result.ok) { logEcsAction(fresh.id, type, result); return result; }
  persistEcsWorldDelta(before, after, fresh.id);
  const out = { ...result, backend: "ecs" };
  logEcsAction(fresh.id, type, out);
  return out;
}

const TX_REQUIRED_ACTIONS = new Set([
  "claim", "place", "upgrade", "demolish", "placeWonder",
  "setupProfile", "customize", "customizerAccess", "repair", "use",
  "talkNpc", "donateNpc", "attackNpc", "donateKeep", "fight", "raid", "attack",
  "wallet", "profileAppearance", "profileFace",
]);

export function dispatch(p: EcsPlayerRow, body: any) {
  const type = String(body?.type || "");
  // Movement and harvest/pickup are high-frequency ECS actions. Keep them off
  // the global sqlite write lock; durable batching is handled by the ECS/tick
  // path instead of wrapping every resource click in BEGIN IMMEDIATE.
  if (!TX_REQUIRED_ACTIONS.has(type)) return dispatchUnlocked(p, body);
  return withImmediateTx(`ecs.dispatch:${type || "unknown"}:uid=${Number(p?.id || 0)}`, () => dispatchUnlocked(p, body));
}

function buildingResourceTick(t = now()) {
  // Clean-slate economy: buildings no longer credit resources passively.
  // Camps/quarries/farms spawn harvestable nodes, warehouses set caps, and
  // reputation over-cap state stops normal building regeneration.
  return cleanEconomyTick(t);
}

export function runWorldTick(reason = "manual") {
  const t = now();
  if (t - ecsTickAt < 4900 && reason !== "manual") return { ok: true, skipped: true, backend: "ecs", at: ecsTickAt };
  ecsTickAt = t;
  try {
    const economy = withImmediateTx(`ecs.worldTick:${reason}`, () => {
      const r = buildingResourceTick(t);
      if (reason === "manual") mirrorLegacyToEcsTables("tick-manual");
      return r;
    });
    const out = { ok: true, backend: "ecs", at: ecsTickAt, reason, economy };
    if (reason !== "interval" || Math.random() < 0.02) recordActivity({ route: "worldTick", action: reason, backend: "ecs" }, "worldTick", out);
    return out;
  } catch (e: any) {
    logError({ route: "worldTick", action: reason, backend: "ecs" }, "ecs.worldTick.failed", e, { reasonCode: "WORLD_TICK_FAILED" });
    return { ok: false, backend: "ecs", at: ecsTickAt, reason, msg: String(e?.message || e || "world tick failed") };
  }
}

export function ensureWorldTickStarted() {
  if (ecsTickStarted) return;
  ecsTickStarted = true;
  mirrorLegacyToEcsTables("boot");
  ecsTickTimer = setInterval(() => runWorldTick("interval"), 5000);
  try { (ecsTickTimer as any)?.unref?.(); } catch {}
}

export function worldTickStatus() {
  return { backend: "ecs", started: ecsTickStarted, lastTickAt: ecsTickAt, migration: ecsMigrationStatus(), economy: cleanEconomyStatus() };
}

export function forceClientRefresh(reason = "Admin published an update") {
  requiredClientVersion = String(Date.now());
  requiredClientReason = String(reason || "Refresh required.").slice(0, 180);
  return { version: requiredClientVersion, reason: requiredClientReason, backend: "ecs" };
}

export function ecsBackendStatus() {
  return { backend: "ecs", tick: worldTickStatus(), rulesBuildings: Object.keys(ecsRulesFromShared().buildings).length, economy: cleanEconomyStatus(), gameplay: ecsGameplayStatus(), coreActions: [...ECS_ACTION_TYPES].sort(), activeActions: activeActionSurface() };
}