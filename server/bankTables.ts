// @ts-nocheck
import { db } from "./db";

function safeJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw || "") as T; } catch { return fallback; }
}
function now() { return Date.now(); }

function tableHandle(name: string) {
  return (db as any)?.[name] || null;
}

export function bankTableAvailable() {
  return process.env.SOLCRAFT_BANK_TABLES !== "0" && !!tableHandle("bankDeposits");
}

function toRowWithdrawal(r: any) {
  return {
    id: r?.withdrawalId || r?.id,
    withdrawalId: r?.withdrawalId || r?.id,
    playerId: Number(r?.playerId || 0),
    wallet: String(r?.wallet || ""),
    to: String(r?.to || r?.toAddress || ""),
    token: String(r?.token || ""),
    tokenAddress: String(r?.tokenAddress || ""),
    tokenLabel: String(r?.tokenLabel || "SOL"),
    amountRaw: String(r?.amountRaw || "0"),
    amountUi: String(r?.amountUi || "0"),
    status: String(r?.status || "pending"),
    signature: r?.signature || null,
    sender: String(r?.sender || "rpc"),
    error: r?.error || null,
    createdAt: Number(r?.createdAt || r?.createdAtMs || 0),
    createdAtMs: Number(r?.createdAtMs || r?.createdAt || 0),
    debitedAt: Number(r?.debitedAt || 0),
    sentAt: Number(r?.sentAt || 0),
    failedAt: Number(r?.failedAt || 0),
    idempotencyKey: String(r?.idempotencyKey || ""),
    coinAmount: String(r?.coinAmount || "0"),
  };
}

export function getBankDeposit(playerId: number) {
  if (!bankTableAvailable()) return null;
  const r = tableHandle("bankDeposits").select().where({ playerId: Number(playerId || 0) }).first() as any;
  return r ? {
    depositId: r.depositId,
    address: r.address,
    wallet: r.wallet,
    createdAt: Number(r.createdAtMs || r.createdAt || 0),
    alreadyExisted: true,
  } : null;
}

export function listBankDeposits() {
  if (!bankTableAvailable()) return [];
  return (tableHandle("bankDeposits").select().all() as any[]).map((r) => ({
    playerId: r.playerId,
    depositId: r.depositId,
    address: r.address,
    wallet: r.wallet,
    createdAt: Number(r.createdAtMs || r.createdAt || 0),
  }));
}

export function upsertBankDeposit(playerId: number, deposit: any) {
  if (!bankTableAvailable()) return deposit;
  const pid = Number(playerId || 0);
  const table = tableHandle("bankDeposits");
  const existing = table.select().where({ playerId: pid }).first() as any;
  const next = {
    playerId: pid,
    depositId: String(deposit?.depositId || deposit?.address || ""),
    address: String(deposit?.address || ""),
    wallet: String(deposit?.wallet || ""),
    createdAtMs: Number(deposit?.createdAt || deposit?.createdAtMs || now()),
  };
  if (existing) {
    Object.assign(existing, next);
    return { depositId: existing.depositId, address: existing.address, wallet: existing.wallet, createdAt: existing.createdAtMs, alreadyExisted: true };
  }
  table.insert(next);
  return deposit;
}

export function getBankScan(playerId: number) {
  if (!bankTableAvailable()) return null;
  const scans = tableHandle("bankScans");
  const events = tableHandle("bankDepositEvents");
  const r = scans?.select().where({ playerId: Number(playerId || 0) }).first() as any;
  if (!r) return null;
  const deposits = events ? ((events.select().where({ playerId: Number(playerId || 0) }).all() as any[])
    .slice(-200)
    .map((e) => ({ signature: e.signature, slot: e.slot, amountRaw: e.amountRaw, amountUi: e.amountUi, confirmedAt: e.confirmedAt }))) : [];
  return {
    ts: Number(r.updatedAtMs || r.updatedAt || 0),
    latestSignature: r.latestSignature || null,
    scanned: Number(r.scanned || 0),
    signatures: safeJson(r.signaturesJson || "[]", []),
    deposits,
    creditedRaw: String(r.creditedRaw || "0"),
    creditedUi: "",
  };
}

export function listBankScans() {
  if (!bankTableAvailable()) return [];
  const scans = tableHandle("bankScans");
  if (!scans) return [];
  return (scans.select().all() as any[]).map((r) => ({
    playerId: r.playerId,
    latestSignature: r.latestSignature,
    creditedRaw: r.creditedRaw,
    scanned: r.scanned,
    updatedAt: r.updatedAtMs,
  }));
}

export function upsertBankScan(playerId: number, scan: any) {
  if (!bankTableAvailable()) return scan;
  const pid = Number(playerId || 0);
  const scans = tableHandle("bankScans");
  const row = scans?.select().where({ playerId: pid }).first() as any;
  const data = {
    latestSignature: scan?.latestSignature || null,
    creditedRaw: String(scan?.creditedRaw || "0"),
    scanned: Number(scan?.scanned || 0),
    updatedAtMs: Number(scan?.ts || scan?.updatedAtMs || now()),
    signaturesJson: JSON.stringify((scan?.signatures || []).slice(-1000)),
  };
  if (row) Object.assign(row, data);
  else scans?.insert({ playerId: pid, ...data });

  const events = tableHandle("bankDepositEvents");
  if (events) for (const d of scan?.deposits || []) {
    if (!d?.signature) continue;
    try {
      events.insert({
        playerId: pid,
        signature: String(d.signature),
        amountRaw: String(d.amountRaw || "0"),
        amountUi: String(d.amountUi || "0"),
        slot: Number(d.slot || 0),
        confirmedAt: Number(d.confirmedAt || now()),
      });
    } catch {}
  }
  return scan;
}

export function listBankWithdrawals(playerId?: number, limit = 100) {
  if (!bankTableAvailable()) return [];
  const table = tableHandle("bankWithdrawals");
  if (!table) return [];
  const rows = playerId ? table.select().where({ playerId: Number(playerId) }).all() : table.select().all();
  return (rows as any[]).slice(-Math.max(1, limit)).map(toRowWithdrawal);
}

export function insertBankWithdrawal(row: any) {
  if (!bankTableAvailable()) return row;
  const table = tableHandle("bankWithdrawals");
  if (!table) return row;
  const w = toRowWithdrawal(row);
  try {
    table.insert({
      withdrawalId: String(w.withdrawalId),
      playerId: w.playerId,
      wallet: w.wallet,
      toAddress: w.to,
      token: w.token,
      tokenAddress: w.tokenAddress,
      tokenLabel: w.tokenLabel,
      amountRaw: w.amountRaw,
      amountUi: w.amountUi,
      coinAmount: w.coinAmount || "0",
      status: w.status,
      signature: w.signature || null,
      sender: w.sender,
      error: w.error || null,
      createdAtMs: Number(w.createdAtMs || now()),
      debitedAt: Number(w.debitedAt || 0),
      sentAt: Number(w.sentAt || 0),
      failedAt: Number(w.failedAt || 0),
      idempotencyKey: w.idempotencyKey || null,
    });
  } catch {}
  return row;
}

export function updateBankWithdrawal(id: string, patch: any) {
  if (!bankTableAvailable()) return null;
  const table = tableHandle("bankWithdrawals");
  if (!table) return null;
  const row = table.select().where({ withdrawalId: String(id || "") }).first() as any;
  if (!row) return null;
  for (const k of ["status", "signature", "error", "sentAt", "failedAt", "amountUi", "idempotencyKey"]) if (k in (patch || {})) row[k] = patch[k];
  return toRowWithdrawal(row);
}

export function insertBankError(action: string, error: any, extra: any = {}) {
  if (!bankTableAvailable()) return;
  const table = tableHandle("bankErrors");
  if (!table) return;
  try {
    table.insert({
      action: String(action || "bank").slice(0, 48),
      msg: String(error?.message || error || "Bank action failed").slice(0, 240),
      extraJson: JSON.stringify(extra || {}),
      createdAtMs: now(),
    });
  } catch {}
}

export function listBankErrors(limit = 50) {
  if (!bankTableAvailable()) return [];
  const table = tableHandle("bankErrors");
  if (!table) return [];
  return (table.select().all() as any[])
    .slice(-Math.max(1, limit))
    .map((r) => ({ ts: r.createdAtMs || r.createdAt, action: r.action, msg: r.msg, ...safeJson(r.extraJson || "{}", {}) }));
}