// @ts-nocheck
import { createMeasure } from "measure-fn";
import { db, metaGet, metaSet } from "./db";
import { getPlayer } from "./playerStore";

const bankMeasure = createMeasure("bank", { maxResultLength: 220 });
const META_BANK_SETTINGS = "solcraft:bank:settings:v1";
const META_BANK_DEPOSITS = "solcraft:bank:deposits:v1";
const META_BANK_SCANS = "solcraft:bank:scans:v1";
const META_BANK_WITHDRAWS = "solcraft:bank:withdrawals:v1";
const META_BANK_ERRORS = "solcraft:bank:errors:v1";
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type BankSettings = {
  enabled: boolean;
  token: string;
  tokenAddress: string;
  tokenLabel: string;
  bankWallet: string;
  treasuryWallet: string;
  rpcEndpoint: string;
  dryRunOnly: boolean;
  minWithdrawUi: string;
  decimals: number;
};

const DEFAULT_BANK: BankSettings = {
  enabled: process.env.SOLCRAFTS_BANK_ENABLED === "1",
  token: process.env.SOLCRAFTS_TOKEN || process.env.SOLCRAFTS_TOKEN_ADDRESS || process.env.SOLCRAFTS_TOKEN_MINT || process.env.NEXT_PUBLIC_SOLCRAFTS_TOKEN_ADDRESS || "solcrafts",
  tokenAddress: process.env.SOLCRAFTS_TOKEN_ADDRESS || process.env.SOLCRAFTS_TOKEN_MINT || process.env.NEXT_PUBLIC_SOLCRAFTS_TOKEN_ADDRESS || "",
  tokenLabel: process.env.SOLCRAFTS_TOKEN_LABEL || "$CRAFTS",
  bankWallet: process.env.SOLCRAFTS_BANK_WALLET || "@dev",
  treasuryWallet: process.env.SOLCRAFTS_MAIN_TREASURY || "@dev",
  rpcEndpoint: process.env.RPC_ENDPOINT || process.env.SOLANA_RPC_ENDPOINT || "",
  dryRunOnly: process.env.SOLCRAFTS_BANK_LIVE !== "1",
  minWithdrawUi: process.env.SOLCRAFTS_BANK_MIN_WITHDRAW_UI || "1",
  decimals: Math.max(0, Math.min(12, Number(process.env.SOLCRAFTS_TOKEN_DECIMALS || process.env.SOLCRAFTS_LOGIN_TOKEN_DECIMALS || "6") || 6)),
};

function readJson(key: string, fallback: any) {
  try { return JSON.parse(metaGet(key, JSON.stringify(fallback)) || JSON.stringify(fallback)); } catch { return fallback; }
}
function writeJson(key: string, value: any) { metaSet(key, JSON.stringify(value)); }
function sanitize(raw: any = {}): BankSettings {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: src.enabled == null ? DEFAULT_BANK.enabled : !!src.enabled,
    token: String(src.token || src.tokenAddress || DEFAULT_BANK.token).trim() || "solcrafts",
    tokenAddress: String((SOL_ADDR.test(String(src.tokenAddress || "")) ? src.tokenAddress : "") || (SOL_ADDR.test(String(src.token || "")) ? src.token : "") || DEFAULT_BANK.tokenAddress).trim(),
    tokenLabel: String(src.tokenLabel || src.label || DEFAULT_BANK.tokenLabel).trim().slice(0, 24) || "$CRAFTS",
    bankWallet: String(src.bankWallet || DEFAULT_BANK.bankWallet).trim() || "@dev",
    treasuryWallet: String(src.treasuryWallet || DEFAULT_BANK.treasuryWallet).trim() || "@dev",
    rpcEndpoint: String(src.rpcEndpoint || DEFAULT_BANK.rpcEndpoint).trim(),
    dryRunOnly: src.dryRunOnly == null ? DEFAULT_BANK.dryRunOnly : !!src.dryRunOnly,
    minWithdrawUi: String(src.minWithdrawUi || DEFAULT_BANK.minWithdrawUi).trim() || "1",
    decimals: Math.max(0, Math.min(12, Math.trunc(Number(src.decimals ?? DEFAULT_BANK.decimals) || 0))),
  };
}
export function bankSettings(): BankSettings {
  return sanitize({ ...DEFAULT_BANK, ...readJson(META_BANK_SETTINGS, {}) });
}
export function publicBankSettings() {
  const s = bankSettings();
  return {
    enabled: !!s.enabled,
    configured: !!s.token && !!s.bankWallet && !!s.rpcEndpoint,
    tokenConfigured: !!s.token,
    tokenAddress: s.tokenAddress || (SOL_ADDR.test(String(s.token || "")) ? s.token : ""),
    token: s.token,
    tokenLabel: s.tokenLabel,
    bankWallet: s.bankWallet,
    treasuryWallet: s.treasuryWallet,
    rpcEndpoint: s.rpcEndpoint,
    dryRunOnly: !!s.dryRunOnly,
    withdrawalsLive: !s.dryRunOnly,
    minWithdrawUi: s.minWithdrawUi,
    decimals: s.decimals,
  };
}
export function setBankSettings(patch: Partial<BankSettings> = {}) {
  const next = sanitize({ ...bankSettings(), ...patch });
  writeJson(META_BANK_SETTINGS, next);
  return { ok: true, bank: publicBankSettings() };
}

function decimalToRaw(value: string | number, decimals: number): bigint {
  const clean = String(value ?? "0").trim().replace(/,/g, ".");
  const [wholeRaw, fracRaw = ""] = clean.split(".");
  const whole = BigInt((wholeRaw || "0").replace(/[^0-9]/g, "") || "0");
  const fracPadded = (fracRaw.replace(/[^0-9]/g, "") + "0".repeat(decimals)).slice(0, decimals);
  return whole * (10n ** BigInt(decimals)) + BigInt(fracPadded || "0");
}
function rawToUi(raw: string | number | bigint, decimals: number) {
  const n = typeof raw === "bigint" ? raw : BigInt(String(raw || "0"));
  if (decimals <= 0) return n.toString();
  const scale = 10n ** BigInt(decimals);
  const whole = n / scale;
  const frac = (n % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
function tokenUnits(n: any, s = bankSettings()) {
  return { amountRaw: String(n || "0"), amountUi: rawToUi(String(n || "0"), s.decimals), tokenLabel: s.tokenLabel };
}
async function createBankClient() {
  // Use the Sowl bank SDK as the single source of truth for SolCrafts token
  // exchange. Sowl reads RPC_ENDPOINT, SOWL_DB_PATH, and related wallet env
  // settings itself, matching scripts/solcraft-bank-sowl.ts.
  try {
    const mod: any = await import("sowl");
    const factory = mod.createTraderSowl || mod.createSowl || mod.default?.createTraderSowl || mod.default?.createSowl;
    if (typeof factory !== "function") throw new Error("Package 'sowl' did not export createTraderSowl().");
    return factory();
  } catch (e: any) {
    throw new Error(`Sowl bank SDK is not available. Install/configure package 'sowl'. ${e?.message || e || ""}`.trim());
  }
}
function deposits() { return readJson(META_BANK_DEPOSITS, {}); }
function scans() { return readJson(META_BANK_SCANS, {}); }
function withdrawals() { return readJson(META_BANK_WITHDRAWS, []); }
function saveWithdrawals(rows: any[]) { writeJson(META_BANK_WITHDRAWS, rows.slice(-500)); }
function bankErrors() { return readJson(META_BANK_ERRORS, []); }
function recordBankError(action: string, error: any, extra: any = {}) {
  const rows = bankErrors();
  rows.push({ ts: Date.now(), action, msg: String(error?.message || error || "Bank action failed"), ...extra });
  writeJson(META_BANK_ERRORS, rows.slice(-100));
}
function bankPlayerById(id: any) {
  const n = Number(id);
  return Number.isFinite(n) ? getPlayer(n) as any : null;
}

export function bankStatusForPlayer(p: any) {
  const s = bankSettings();
  const dep = deposits()[String(p.id)] || null;
  const scan = scans()[String(p.id)] || null;
  const rows = withdrawals().filter((r: any) => Number(r.playerId) === Number(p.id)).slice(-20).reverse();
  const bankRaw = BigInt(Math.max(0, Math.floor(Number(p?.inv?.g || 0)))).toString();
  return {
    ok: true,
    config: publicBankSettings(),
    wallet: p.wallet || "",
    deposit: dep,
    latestDepositScan: scan,
    bankTokens: { amountRaw: bankRaw, amountUi: bankRaw, tokenLabel: s.tokenLabel },
    walletBalance: tokenUnits(p.tokenBalanceRaw || 0, s),
    walletBalanceApproxUi: String(p.tokenBalance || 0),
    withdrawals: rows,
    notes: [
      "Bank tokens are your in-game exchange balance.",
      `Wallet ${s.tokenLabel} is your on-chain connected-wallet balance.`,
      "Your personal deposit address is generated once and reused.",
      "Send tokens to that address, then scan to credit your in-game balance.",
      "Withdrawals pay to the wallet that signed in unless the server explicitly overrides it.",
    ],
  };
}

export async function exchangeBankStatusForPlayer(p: any) {
  const s = bankSettings();
  let status: any = bankStatusForPlayer(p);
  if (!s.enabled || !p.wallet) return { ...status, exchangeReady: !!status.deposit?.address };
  if (status.deposit?.address) return { ...status, exchangeReady: true };
  const res = await ensureDepositWallet(p);
  if (res?.ok && res?.status) return { ...res.status, exchangeReady: true, depositPrepared: true };
  return { ...status, exchangeReady: false, depositError: res?.msg || "Deposit address could not be prepared.", depositReasonCode: res?.reasonCode || "BANK_DEPOSIT_FAILED" };
}

export function bankAdminStatus() {
  const s = bankSettings();
  const dep = deposits();
  const scan = scans();
  const w = withdrawals();
  return {
    config: publicBankSettings(),
    deposits: Object.entries(dep).map(([playerId, d]: any) => ({ playerId, ...d })),
    lastScans: Object.entries(scan).map(([playerId, d]: any) => ({ playerId, ...d })),
    withdrawals: w.slice(-100).reverse(),
    lastErrors: bankErrors().slice(-50).reverse(),
    summary: {
      enabled: !!s.enabled,
      dryRunOnly: !!s.dryRunOnly,
      withdrawalsLive: !s.dryRunOnly,
      tokenConfigured: !!s.token,
      tokenAddress: s.tokenAddress || (SOL_ADDR.test(String(s.token || "")) ? s.token : ""),
      depositWallets: Object.keys(dep).length,
      withdrawalRequests: w.length,
      pendingWithdrawals: w.filter((r: any) => r.status === "pending" || r.status === "dry-run").length,
      lastError: bankErrors().slice(-1)[0] || null,
    },
  };
}

export async function ensureDepositWallet(p: any) {
  const s = bankSettings();
  if (!s.enabled) return { ok: false, reasonCode: "BANK_DISABLED", msg: "Bank deposits are not enabled yet." };
  if (!p.wallet) return { ok: false, reasonCode: "WALLET_REQUIRED", msg: "Connect Phantom first." };
  const all = deposits();
  const existing = all[String(p.id)];
  if (existing?.address) return { ok: true, deposit: existing, alreadyExisted: true, status: bankStatusForPlayer(p) };
  return bankMeasure.measure({ start: () => `generate deposit player=${p.id}`, end: (r: any) => ({ ok: r.ok, address: r.deposit?.address?.slice?.(0, 8) }), budget: 1200 }, async () => {
    const sowl = await createBankClient();
    try {
      const result = await sowl.bank.generateDepositWallet({ userId: String(p.id), label: `solcrafts:${p.id}` });
      const deposit = { depositId: result.depositId, address: result.address, wallet: p.wallet, createdAt: Date.now(), alreadyExisted: !!result.alreadyExisted };
      all[String(p.id)] = deposit;
      writeJson(META_BANK_DEPOSITS, all);
      return { ok: true, deposit, alreadyExisted: !!result.alreadyExisted, status: bankStatusForPlayer(p) };
    } finally { sowl.close?.(); }
  }).catch((e: any) => ({ ok: false, reasonCode: "BANK_DEPOSIT_FAILED", msg: String(e?.message || e || "Could not generate deposit wallet.") }));
}

export async function scanBankDeposits(p: any, limit = 50) {
  const s = bankSettings();
  if (!s.enabled) return { ok: false, reasonCode: "BANK_DISABLED", msg: "Bank deposits are not enabled yet." };
  const depRes = await ensureDepositWallet(p);
  if (!depRes.ok) return depRes;
  const dep = depRes.deposit;
  const byPlayer = scans();
  const prev = byPlayer[String(p.id)] || {};
  return bankMeasure.measure({ start: () => `scan deposits player=${p.id}`, end: (r: any) => ({ ok: r.ok, credited: r.creditedUi, found: r.deposits?.length || 0 }), budget: 2500 }, async () => {
    const sowl = await createBankClient();
    try {
      const result = await sowl.bank.scanDeposits({ token: s.token, deposit: dep.depositId || dep.address, limit: Math.max(1, Math.min(100, Number(limit) || 50)), afterSignature: prev.latestSignature || null, commitment: "confirmed" });
      const seen = new Set([...(prev.signatures || [])]);
      let creditRaw = 0n;
      const fresh: any[] = [];
      for (const d of result.deposits || []) {
        if (!d.signature || seen.has(d.signature)) continue;
        seen.add(d.signature);
        const raw = BigInt(String(d.amountRaw || "0"));
        if (raw > 0n) creditRaw += raw;
        fresh.push({ signature: d.signature, slot: d.slot, amountRaw: String(d.amountRaw || "0"), amountUi: d.amountUi, confirmedAt: d.confirmedAt });
      }
      if (creditRaw > 0n) {
        const tokens = Number(rawToUi(creditRaw, s.decimals));
        const inv = { ...(p.inv || {}) };
        inv.g = Math.max(0, Number(inv.g || 0)) + Math.floor(tokens);
        p.inv = inv;
      }
      byPlayer[String(p.id)] = { ts: Date.now(), latestSignature: result.latestSignature || prev.latestSignature || null, scanned: result.scanned || 0, signatures: Array.from(seen).slice(-1000), deposits: [...(prev.deposits || []), ...fresh].slice(-200), creditedRaw: String((BigInt(prev.creditedRaw || "0") + creditRaw)), creditedUi: rawToUi(BigInt(prev.creditedRaw || "0") + creditRaw, s.decimals) };
      writeJson(META_BANK_SCANS, byPlayer);
      return { ok: true, creditedRaw: creditRaw.toString(), creditedUi: rawToUi(creditRaw, s.decimals), deposits: fresh, scan: byPlayer[String(p.id)], status: bankStatusForPlayer(p) };
    } finally { sowl.close?.(); }
  }).catch((e: any) => ({ ok: false, reasonCode: "BANK_SCAN_FAILED", msg: String(e?.message || e || "Could not scan deposit wallet."), status: bankStatusForPlayer(p) }));
}

export async function requestBankWithdrawal(p: any, amountUi: string | number, toWallet?: string) {
  const s = bankSettings();
  if (!s.enabled) return { ok: false, reasonCode: "BANK_DISABLED", msg: "Bank withdrawals are not enabled yet." };
  const to = String(toWallet || p.wallet || "").trim();
  if (!SOL_ADDR.test(to)) return { ok: false, reasonCode: "WALLET_REQUIRED", msg: "Connect Phantom or provide a valid Solana wallet." };
  const amountRaw = decimalToRaw(amountUi, s.decimals);
  const minRaw = decimalToRaw(s.minWithdrawUi, s.decimals);
  if (amountRaw < minRaw) return { ok: false, reasonCode: "BANK_WITHDRAW_MIN", msg: `Withdraw at least ${s.minWithdrawUi} ${s.tokenLabel}.` };
  const bankTokens = BigInt(Math.max(0, Math.floor(Number(p?.inv?.g || 0))));
  const spendUi = Math.ceil(Number(rawToUi(amountRaw, s.decimals)) || 0);
  if (bankTokens < BigInt(spendUi)) return { ok: false, reasonCode: "BANK_TOKENS_LOW", msg: `Not enough bank tokens. You have ${bankTokens.toString()} ${s.tokenLabel}.` };

  return bankMeasure.measure({ start: () => `withdraw player=${p.id} amount=${amountUi}`, end: (r: any) => ({ ok: r.ok, status: r.withdrawal?.status || r.status, signature: r.withdrawal?.signature || null }), budget: 2600 }, async () => {
    const rows = withdrawals();
    const id = crypto.randomUUID?.() || `${Date.now()}:${p.id}`;
    const inv = { ...(p.inv || {}) };
    inv.g = Math.max(0, Math.floor(Number(inv.g || 0)) - spendUi);
    p.inv = inv;

    const row: any = {
      id,
      playerId: p.id,
      wallet: p.wallet || "",
      to,
      token: s.token,
      tokenAddress: s.tokenAddress || (SOL_ADDR.test(String(s.token || "")) ? s.token : ""),
      tokenLabel: s.tokenLabel,
      amountRaw: amountRaw.toString(),
      amountUi: rawToUi(amountRaw, s.decimals),
      status: "pending",
      signature: null,
      createdAt: Date.now(),
      debitedAt: Date.now(),
      sender: "rpc",
    };

    try {
      if (s.dryRunOnly) {
        rows.push(row); saveWithdrawals(rows);
        return { ok: true, withdrawal: row, status: bankStatusForPlayer(p), msg: `Withdrawal request created for ${row.amountUi} ${s.tokenLabel}. It will be sent when transfers are enabled.` };
      }

      const sowl = await createBankClient();
      try {
        const result = await sowl.bank.sendToken({
          token: s.token,
          from: s.bankWallet,
          to,
          amountRaw,
          sender: "rpc",
          live: true,
        });
        row.status = "sent";
        row.signature = result?.signature || null;
        row.sentAt = Date.now();
        row.amountUi = result?.amountUi || row.amountUi;
        rows.push(row); saveWithdrawals(rows);
        return { ok: true, withdrawal: row, ...row, status: bankStatusForPlayer(p), msg: `Withdrawal sent: ${row.amountUi} ${s.tokenLabel}.` };
      } finally { sowl.close?.(); }
    } catch (e: any) {
      const refund = { ...(p.inv || {}) };
      refund.g = Math.max(0, Math.floor(Number(refund.g || 0)) + spendUi);
      p.inv = refund;
      row.status = "failed";
      row.failedAt = Date.now();
      row.error = String(e?.message || e || "Token send failed");
      rows.push(row); saveWithdrawals(rows);
      recordBankError("withdraw", e, { playerId: p.id, to, amountUi: row.amountUi });
      return { ok: false, reasonCode: "BANK_WITHDRAW_FAILED", msg: row.error, status: bankStatusForPlayer(p), withdrawal: row };
    }
  }).catch((e: any) => ({ ok: false, reasonCode: "BANK_WITHDRAW_FAILED", msg: String(e?.message || e || "Could not create withdrawal."), status: bankStatusForPlayer(p) }));
}


export async function adminBankScanAllDeposits(limit = 50) {
  const dep = deposits();
  const rows: any[] = [];
  for (const playerId of Object.keys(dep)) {
    const p = bankPlayerById(playerId);
    if (!p) { rows.push({ ok: false, playerId, reasonCode: "PLAYER_MISSING", msg: "Player not found." }); continue; }
    try { rows.push({ playerId, ...(await scanBankDeposits(p, limit)) }); }
    catch (e: any) { recordBankError("scan-all", e, { playerId }); rows.push({ ok: false, playerId, msg: String(e?.message || e) }); }
  }
  return { ok: true, scannedPlayers: rows.length, results: rows, bank: bankAdminStatus() };
}

export async function adminBankCheckWithdraw(to: string, amountUi: string | number) {
  const s = bankSettings();
  const wallet = String(to || "").trim();
  if (!SOL_ADDR.test(wallet)) return { ok: false, reasonCode: "WALLET_REQUIRED", msg: "Enter a valid Solana wallet address." };
  const amountRaw = decimalToRaw(amountUi, s.decimals);
  if (amountRaw <= 0n) return { ok: false, reasonCode: "AMOUNT_REQUIRED", msg: "Enter an amount greater than zero." };
  return bankMeasure.measure({ start: () => `admin check withdraw amount=${amountUi}`, end: (r: any) => ({ ok: r.ok, status: r.status, dryRun: r.dryRun }), budget: 1600 }, async () => {
    try {
      const sowl = await createBankClient();
      try {
        const result = await sowl.bank.sendToken({ token: s.token, from: s.bankWallet, to: wallet, amountRaw, createRecipientAccount: true, sender: "rpc", live: false });
        const row = { id: crypto.randomUUID?.() || `admin:${Date.now()}`, playerId: 0, wallet, to: wallet, token: s.token, tokenAddress: s.tokenAddress || (SOL_ADDR.test(String(s.token || "")) ? s.token : ""), tokenLabel: s.tokenLabel, amountRaw: amountRaw.toString(), amountUi: result.amountUi || rawToUi(amountRaw, s.decimals), dryRun: true, signature: result.signature || null, status: result.status || "check", adminDryRun: true, createdAt: Date.now() };
        const rows = withdrawals(); rows.push(row); saveWithdrawals(rows);
        return { ok: true, ...row, bank: bankAdminStatus(), msg: `Withdrawal check complete for ${row.amountUi} ${s.tokenLabel}.` };
      } finally { sowl.close?.(); }
    } catch (e: any) { recordBankError("admin-check-withdraw", e, { to: wallet, amountUi }); return { ok: false, reasonCode: "BANK_WITHDRAW_CHECK_FAILED", msg: String(e?.message || e) }; }
  });
}

export async function adminBankSweepDeposit(deposit: string) {
  const s = bankSettings();
  const key = String(deposit || "").trim();
  if (!key) return { ok: false, reasonCode: "DEPOSIT_REQUIRED", msg: "Choose a deposit id/address to sweep." };
  return bankMeasure.measure({ start: () => `admin check sweep deposit=${key.slice(0, 10)}`, end: (r: any) => ({ ok: r.ok, skipped: r.skipped, amountUi: r.amountUi }), budget: 2000 }, async () => {
    try {
      const sowl = await createBankClient();
      try {
        const result = await sowl.bank.sweepDepositWallet({ token: s.token, deposit: key, to: s.treasuryWallet, closeEmptyTokenAccount: true, sender: "rpc", live: false });
        return { ok: true, dryRun: true, ...result, bank: bankAdminStatus(), msg: result.skipped ? `Sweep check skipped: ${result.skipped}` : `Sweep check found ${result.amountUi || "0"} ${s.tokenLabel}.` };
      } finally { sowl.close?.(); }
    } catch (e: any) { recordBankError("admin-sweep", e, { deposit: key }); return { ok: false, reasonCode: "BANK_SWEEP_FAILED", msg: String(e?.message || e) }; }
  });
}

export async function adminBankCheckBalances() {
  const s = bankSettings();
  return bankMeasure.measure({ start: () => `admin balances token=${s.token}`, end: (r: any) => ({ ok: r.ok }), budget: 2200 }, async () => {
    const sowl = await createBankClient();
    try {
      const [bank, treasury] = await Promise.all([
        sowl.bank.tokenBalance({ token: s.token, owner: s.bankWallet }),
        sowl.bank.tokenBalance({ token: s.token, owner: s.treasuryWallet }),
      ]);
      return { ok: true, token: s.token, tokenLabel: s.tokenLabel, bankWallet: s.bankWallet, treasuryWallet: s.treasuryWallet, balances: { bank, treasury }, bank: bankAdminStatus() };
    } finally { sowl.close?.(); }
  }).catch((e: any) => { recordBankError("admin-balances", e); return { ok: false, reasonCode: "BANK_BALANCE_FAILED", msg: String(e?.message || e) }; });
}

export async function adminBankProcessPendingWithdrawals(limit = 25) {
  const s = bankSettings();
  if (!s.enabled) return { ok: false, reasonCode: "BANK_DISABLED", msg: "Bank is disabled." };
  if (s.dryRunOnly) return { ok: false, reasonCode: "BANK_TRANSFERS_PAUSED", msg: "Live transfers are paused. Disable pause in Bank Studio after verifying the wallet, token, and RPC endpoint." };
  const rows = withdrawals();
  const pending = rows.filter((r: any) => String(r.status || "pending") === "pending" && !r.signature && r.to && BigInt(String(r.amountRaw || "0")) > 0n).slice(0, Math.max(1, Math.min(100, Number(limit) || 25)));
  const out: any[] = [];
  if (!pending.length) return { ok: true, processed: 0, results: [], bank: bankAdminStatus(), msg: "No pending withdrawals." };
  const sowl = await createBankClient();
  try {
    for (const row of pending) {
      try {
        const player = bankPlayerById(row.playerId);
        if (!row.debitedAt && player) {
          const spendUi = Math.ceil(Number(rawToUi(row.amountRaw, s.decimals)) || 0);
          const inv = { ...(player.inv || {}) };
          if (Math.floor(Number(inv.g || 0)) < spendUi) throw new Error(`Player ${row.playerId} no longer has enough in-game balance to cover ${row.amountUi} ${s.tokenLabel}.`);
          inv.g = Math.max(0, Math.floor(Number(inv.g || 0)) - spendUi);
          player.inv = inv;
          row.debitedAt = Date.now();
        }
        const result = await sowl.bank.sendToken({ token: row.token || s.token, from: s.bankWallet, to: row.to, amountRaw: BigInt(String(row.amountRaw || "0")), sender: "rpc", live: true });
        row.status = "sent";
        row.signature = result?.signature || null;
        row.sentAt = Date.now();
        row.error = null;
        out.push({ ok: true, id: row.id, to: row.to, amountUi: row.amountUi, signature: row.signature });
      } catch (e: any) {
        row.lastAttemptAt = Date.now();
        row.error = String(e?.message || e);
        recordBankError("process-withdrawal", e, { id: row.id, playerId: row.playerId, to: row.to });
        out.push({ ok: false, id: row.id, playerId: row.playerId, msg: row.error });
      }
    }
    saveWithdrawals(rows);
    const sent = out.filter((r) => r.ok).length;
    return { ok: true, processed: out.length, sent, failed: out.length - sent, results: out, bank: bankAdminStatus(), msg: `Processed ${out.length} pending withdrawal(s); sent ${sent}.` };
  } finally { sowl.close?.(); }
}