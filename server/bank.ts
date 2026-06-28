// @ts-nocheck
import { createMeasure } from "measure-fn";
import { db, metaGet, metaSet } from "./db";
import { getPlayer, refreshPlayer } from "./playerStore";
import { getBankDeposit, listBankDeposits, upsertBankDeposit, getBankScan, listBankScans, upsertBankScan, listBankWithdrawals, insertBankWithdrawal, updateBankWithdrawal, insertBankError, listBankErrors, bankTableAvailable } from "./bankTables";
import { withImmediateTx } from "./dbTx";
import { appendCoinLedger } from "./coinLedger";
import { appendHardCurrencyLedger, hardCurrencyBalanceRaw } from "./hardCurrencyLedger";
import { SOLCRAFT_ECONOMY } from "./economyConfig";
import { assertBankDeltaBalanced, assertNonNegativeInventory } from "./economyInvariants";

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
  coinsPerSol: number;
  bankWallet: string;
  treasuryWallet: string;
  rpcEndpoint: string;
  dryRunOnly: boolean;
  minWithdrawUi: string;
  decimals: number;
  withdrawGameCoinsEnabled: boolean;
};

const DEFAULT_BANK: BankSettings = {
  enabled: process.env.SOLCRAFTS_BANK_ENABLED === "1",
  token: process.env.SOLCRAFTS_TOKEN || process.env.SOLCRAFTS_TOKEN_ADDRESS || process.env.SOLCRAFTS_TOKEN_MINT || process.env.SOLCRAFT_CONFIG || "solcrafts",
  tokenAddress: process.env.SOLCRAFTS_TOKEN_ADDRESS || process.env.SOLCRAFTS_TOKEN_MINT || process.env.SOLCRAFT_CONFIG || "",
  tokenLabel: process.env.SOLCRAFTS_TOKEN_LABEL || process.env.SOLCRAFTS_BANK_TOKEN_LABEL || "SOL",
  bankWallet: process.env.SOLCRAFTS_BANK_WALLET || "@dev",
  treasuryWallet: process.env.SOLCRAFTS_MAIN_TREASURY || "@dev",
  rpcEndpoint: process.env.RPC_ENDPOINT || process.env.SOLANA_RPC_ENDPOINT || "",
  dryRunOnly: process.env.SOLCRAFTS_BANK_LIVE !== "1",
  minWithdrawUi: process.env.SOLCRAFTS_BANK_MIN_WITHDRAW_UI || "1",
  decimals: Math.max(0, Math.min(12, Number(process.env.SOLCRAFTS_TOKEN_DECIMALS || process.env.SOLCRAFTS_SOL_DECIMALS || "9") || 9)),
  withdrawGameCoinsEnabled: process.env.SOLCRAFTS_BANK_WITHDRAW_GAME_COINS !== "0",
  coinsPerSol: Math.max(1, Number(process.env.SOLCRAFTS_BANK_COINS_PER_SOL || SOLCRAFT_ECONOMY.money.defaultCoinsPerSol || 1000) || 1000),
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
    tokenLabel: String(src.tokenLabel || src.label || DEFAULT_BANK.tokenLabel).trim().slice(0, 24) || "SOL",
    coinsPerSol: Math.max(1, Number(src.coinsPerSol ?? DEFAULT_BANK.coinsPerSol) || DEFAULT_BANK.coinsPerSol),
    bankWallet: String(src.bankWallet || DEFAULT_BANK.bankWallet).trim() || "@dev",
    treasuryWallet: String(src.treasuryWallet || DEFAULT_BANK.treasuryWallet).trim() || "@dev",
    rpcEndpoint: String(src.rpcEndpoint || DEFAULT_BANK.rpcEndpoint).trim(),
    dryRunOnly: src.dryRunOnly == null ? DEFAULT_BANK.dryRunOnly : !!src.dryRunOnly,
    minWithdrawUi: String(src.minWithdrawUi || DEFAULT_BANK.minWithdrawUi).trim() || "1",
    decimals: Math.max(0, Math.min(12, Math.trunc(Number(src.decimals ?? DEFAULT_BANK.decimals) || 0))),
    withdrawGameCoinsEnabled: src.withdrawGameCoinsEnabled == null ? DEFAULT_BANK.withdrawGameCoinsEnabled : !!src.withdrawGameCoinsEnabled,
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
    withdrawGameCoinsEnabled: !!s.withdrawGameCoinsEnabled,
    hardCurrencyWithdrawals: false,
    principalBoundedWithdrawals: true,
    coinsPerSol: s.coinsPerSol,
    solDepositsBuyGameplayCoins: true,
    craftsBuffOnly: true,
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
function withdrawIdempotencyKey(p: any, amountRaw: bigint, to: string, provided?: string) {
  const raw = String(provided || "").trim();
  if (raw) return raw.slice(0, 120);
  // Safety fallback for old clients: collapse accidental double taps/retries in a short window.
  return `legacy:${Number(p?.id || 0)}:${to}:${amountRaw.toString()}:${Math.floor(Date.now() / 10000)}`;
}
function withdrawalByIdempotency(rows: any[], playerId: number, key: string) {
  if (!key) return null;
  return (rows || []).find((r: any) => Number(r.playerId) === Number(playerId) && String(r.idempotencyKey || "") === key) || null;
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
function deposits() {
  if (bankTableAvailable()) return Object.fromEntries(listBankDeposits().map((d: any) => [String(d.playerId), d]));
  return readJson(META_BANK_DEPOSITS, {});
}
function scans() {
  if (bankTableAvailable()) return Object.fromEntries(listBankScans().map((d: any) => [String(d.playerId), d]));
  return readJson(META_BANK_SCANS, {});
}
function withdrawalRows(playerId?: number, limit = 500) {
  if (bankTableAvailable()) return listBankWithdrawals(playerId, limit);
  const rows = readJson(META_BANK_WITHDRAWS, []);
  return playerId ? rows.filter((r: any) => Number(r.playerId) === Number(playerId)) : rows;
}
function withdrawals() { return withdrawalRows(undefined, 500); }
function saveWithdrawals(rows: any[]) { if (!bankTableAvailable()) writeJson(META_BANK_WITHDRAWS, rows.slice(-500)); }
function bankErrors() { return bankTableAvailable() ? listBankErrors(100) : readJson(META_BANK_ERRORS, []); }
function recordBankError(action: string, error: any, extra: any = {}) {
  insertBankError(action, error, extra);
  if (bankTableAvailable()) return;
  const rows = bankErrors();
  rows.push({ ts: Date.now(), action, msg: String(error?.message || error || "Bank action failed"), ...extra });
  writeJson(META_BANK_ERRORS, rows.slice(-100));
}
function bankPlayerById(id: any) {
  const n = Number(id);
  return Number.isFinite(n) ? getPlayer(n) as any : null;
}

function asRawBigInt(value: any): bigint {
  try { return BigInt(String(value || "0")); } catch { return 0n; }
}

function nonFailedWithdrawalStatus(status: any) {
  const s = String(status || "pending").toLowerCase();
  return !["failed", "refunded", "refund", "cancelled", "canceled", "rejected", "void"].includes(s);
}

export function depositedPrincipalRawForPlayer(playerId: number): bigint {
  const scan = bankTableAvailable() ? getBankScan(playerId) : scans()[String(playerId)] || null;
  return asRawBigInt(scan?.creditedRaw || "0");
}

export function nonFailedWithdrawnRawForPlayer(playerId: number): bigint {
  return withdrawalRows(playerId, 5000)
    .filter((r: any) => nonFailedWithdrawalStatus(r?.status))
    .reduce((sum: bigint, r: any) => sum + asRawBigInt(r?.amountRaw || "0"), 0n);
}

export function withdrawablePrincipalRawForPlayer(playerId: number): bigint {
  const remaining = depositedPrincipalRawForPlayer(playerId) - nonFailedWithdrawnRawForPlayer(playerId);
  return remaining > 0n ? remaining : 0n;
}

function coinAmountForRaw(raw: bigint, s = bankSettings()) {
  if (raw <= 0n) return 0;
  const coins = (raw * BigInt(Math.max(1, Math.floor(s.coinsPerSol)))) / (10n ** BigInt(s.decimals));
  return Math.max(0, Math.floor(Number(coins.toString()) || 0));
}

export function bankPrincipalInvariantForPlayer(playerId: number, s = bankSettings()) {
  const depositedRaw = depositedPrincipalRawForPlayer(playerId);
  const withdrawnRaw = nonFailedWithdrawnRawForPlayer(playerId);
  const withdrawableRaw = withdrawablePrincipalRawForPlayer(playerId);
  const ok = withdrawableRaw >= 0n && withdrawableRaw <= depositedRaw && withdrawnRaw >= 0n;
  return {
    ok,
    playerId,
    depositedRaw: depositedRaw.toString(),
    withdrawnRaw: withdrawnRaw.toString(),
    withdrawableRaw: withdrawableRaw.toString(),
    withdrawableUi: rawToUi(withdrawableRaw, s.decimals),
    reasonCode: ok ? "BANK_PRINCIPAL_INVARIANT_OK" : "BANK_PRINCIPAL_INVARIANT_FAILED",
  };
}

function bankPrincipalStatus(playerId: number, s = bankSettings()) {
  const depositedRaw = depositedPrincipalRawForPlayer(playerId);
  const withdrawnRaw = nonFailedWithdrawnRawForPlayer(playerId);
  const withdrawableRaw = withdrawablePrincipalRawForPlayer(playerId);
  return {
    depositedRaw: depositedRaw.toString(),
    depositedUi: rawToUi(depositedRaw, s.decimals),
    withdrawnRaw: withdrawnRaw.toString(),
    withdrawnUi: rawToUi(withdrawnRaw, s.decimals),
    withdrawableRaw: withdrawableRaw.toString(),
    withdrawableUi: rawToUi(withdrawableRaw, s.decimals),
    withdrawableCoins: coinAmountForRaw(withdrawableRaw, s),
    tokenLabel: s.tokenLabel,
  };
}

export function bankStatusForPlayer(p: any) {
  const s = bankSettings();
  const dep = bankTableAvailable() ? getBankDeposit(p.id) : deposits()[String(p.id)] || null;
  const scan = bankTableAvailable() ? getBankScan(p.id) : scans()[String(p.id)] || null;
  const rows = withdrawalRows(p.id, 20).slice(-20).reverse();
  const softCoins = Math.max(0, Math.floor(Number(p?.inv?.g || 0)));
  const principal = bankPrincipalStatus(p.id, s);
  const withdrawableCoins = Math.min(softCoins, principal.withdrawableCoins);
  return {
    ok: true,
    config: publicBankSettings(),
    wallet: p.wallet || "",
    deposit: dep,
    latestDepositScan: scan,
    // Legacy field kept for older UI: this is now the principal-bounded
    // withdrawable coin amount, not the player's total gameplay coin purse.
    bankTokens: { amountRaw: String(withdrawableCoins), amountUi: String(withdrawableCoins), tokenLabel: "coins" },
    softCoins,
    gameplayCoins: softCoins,
    withdrawableCoins,
    depositedPrincipal: principal,
    withdrawablePrincipal: { amountRaw: principal.withdrawableRaw, amountUi: principal.withdrawableUi, tokenLabel: s.tokenLabel },
    walletBalance: tokenUnits(p.tokenBalanceRaw || 0, s),
    walletBalanceApproxUi: String(p.tokenBalance || 0),
    withdrawals: rows,
    exchangeRate: { coinsPerSol: s.coinsPerSol, tokenLabel: s.tokenLabel },
    notes: [
      `${s.tokenLabel} deposits buy non-withdrawable gameplay coins at the admin-configured bank rate.`,
      "Withdrawals are capped by your own scanned deposit principal minus prior non-failed withdrawals.",
      "Gameplay faucets can raise your coin purse, but they do not raise the SOL withdrawal cap.",
      "$CRAFTS stays in the connected wallet and is read for buffs; it is not deposited into the game.",
      "Your personal deposit address is generated once and reused.",
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
      tableMode: bankTableAvailable(),
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
  const existing = bankTableAvailable() ? getBankDeposit(p.id) : all[String(p.id)];
  if (existing?.address) return { ok: true, deposit: existing, alreadyExisted: true, status: bankStatusForPlayer(p) };
  return bankMeasure.measure({ start: () => `generate deposit player=${p.id}`, end: (r: any) => ({ ok: r.ok, address: r.deposit?.address?.slice?.(0, 8) }), budget: 1200 }, async () => {
    const sowl = await createBankClient();
    try {
      const result = await sowl.bank.generateDepositWallet({ userId: String(p.id), label: `solcrafts:${p.id}` });
      const deposit = { depositId: result.depositId, address: result.address, wallet: p.wallet, createdAt: Date.now(), alreadyExisted: !!result.alreadyExisted };
      upsertBankDeposit(p.id, deposit);
      if (!bankTableAvailable()) { all[String(p.id)] = deposit; writeJson(META_BANK_DEPOSITS, all); }
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
  const prev = bankTableAvailable() ? (getBankScan(p.id) || {}) : byPlayer[String(p.id)] || {};
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
      let creditedCoins = 0;
      if (creditRaw > 0n) {
        const solUi = Number(rawToUi(creditRaw, s.decimals)) || 0;
        creditedCoins = Math.max(0, Math.floor(solUi * s.coinsPerSol));
        if (creditedCoins > 0) withImmediateTx(`bank.scan.credit:${p.id}`, () => {
          const row = getPlayer(p.id) as any || p;
          const before = Math.max(0, Math.floor(Number(row?.inv?.g || 0)));
          row.inv = { ...(row.inv || {}), g: before + creditedCoins };
          assertNonNegativeInventory(row.inv);
          refreshPlayer(row);
          appendCoinLedger({
            player: p.id,
            delta: creditedCoins,
            reason: "bankSolDepositCoins",
            refType: "bankDepositScan",
            refId: result.latestSignature || fresh[0]?.signature || String(Date.now()),
            idempotencyKey: `deposit:${p.id}:${result.latestSignature || fresh.map((d:any)=>d.signature).join(',')}`,
            meta: { amountRaw: creditRaw.toString(), amountUi: rawToUi(creditRaw, s.decimals), token: s.token, tokenAddress: s.tokenAddress, coinsPerSol: s.coinsPerSol },
          });
        });
      }
      byPlayer[String(p.id)] = { ts: Date.now(), latestSignature: result.latestSignature || prev.latestSignature || null, scanned: result.scanned || 0, signatures: Array.from(seen).slice(-1000), deposits: [...(prev.deposits || []), ...fresh].slice(-200), creditedRaw: String((BigInt(prev.creditedRaw || "0") + creditRaw)), creditedUi: rawToUi(BigInt(prev.creditedRaw || "0") + creditRaw, s.decimals) };
      withImmediateTx(`bank.scan.record:${p.id}`, () => { upsertBankScan(p.id, byPlayer[String(p.id)]); if (!bankTableAvailable()) writeJson(META_BANK_SCANS, byPlayer); });
      return { ok: true, creditedRaw: creditRaw.toString(), creditedUi: rawToUi(creditRaw, s.decimals), creditedCoins, deposits: fresh, scan: byPlayer[String(p.id)], status: bankStatusForPlayer(getPlayer(p.id) || p) };
    } finally { sowl.close?.(); }
  }).catch((e: any) => ({ ok: false, reasonCode: "BANK_SCAN_FAILED", msg: String(e?.message || e || "Could not scan deposit wallet."), status: bankStatusForPlayer(p) }));
}

export async function requestBankWithdrawal(p: any, amountUi: string | number, toWallet?: string, idempotencyKeyInput?: string) {
  const s = bankSettings();
  if (!s.enabled) return { ok: false, reasonCode: "BANK_DISABLED", msg: "Bank withdrawals are not enabled yet." };
  const to = String(toWallet || p.wallet || "").trim();
  if (!SOL_ADDR.test(to)) return { ok: false, reasonCode: "WALLET_REQUIRED", msg: "Connect Phantom or provide a valid Solana wallet." };
  const spendCoins = Math.max(0, Math.floor(Number(amountUi || 0)));
  const minCoins = Math.max(1, Math.floor(Number(s.minWithdrawUi || SOLCRAFT_ECONOMY.money.minWithdrawCoins || 10) || 10));
  if (spendCoins < minCoins) return { ok: false, reasonCode: "BANK_WITHDRAW_MIN", msg: `Withdraw at least ${minCoins} coins.` };
  const amountRaw = (BigInt(spendCoins) * (10n ** BigInt(s.decimals))) / BigInt(Math.max(1, Math.floor(s.coinsPerSol)));
  const idem = withdrawIdempotencyKey(p, amountRaw, to, idempotencyKeyInput);

  return bankMeasure.measure({ start: () => `withdraw player=${p.id} amount=${amountUi}`, end: (r: any) => ({ ok: r.ok, status: r.withdrawal?.status || r.status, signature: r.withdrawal?.signature || null, idempotencyKey: r.withdrawal?.idempotencyKey || null }), budget: 2600 }, async () => {
    let rows = withdrawals();
    const existing = withdrawalByIdempotency(rows, p.id, idem);
    if (existing) return { ok: true, duplicate: true, withdrawal: existing, status: bankStatusForPlayer(p), msg: `Withdrawal request already exists for ${existing.amountUi} ${s.tokenLabel}.` };

    const freshPlayer = getPlayer(p.id) as any || p;
    const coinBal = Math.max(0, Math.floor(Number(freshPlayer?.inv?.g || 0)));
    const principal = bankPrincipalStatus(p.id, s);
    const withdrawableRaw = asRawBigInt(principal.withdrawableRaw);
    const withdrawableCoins = Math.min(coinBal, principal.withdrawableCoins);
    if (!s.withdrawGameCoinsEnabled) return { ok: false, reasonCode: "BANK_WITHDRAW_DISABLED", msg: "Principal-bounded withdrawals are paused by the operator." };
    if (amountRaw <= 0n) return { ok: false, reasonCode: "BANK_WITHDRAW_TOO_SMALL", msg: "That amount is too small to withdraw at the current exchange rate." };
    if (amountRaw > withdrawableRaw) return { ok: false, reasonCode: "BANK_PRINCIPAL_LOW", msg: `Only ${withdrawableCoins} coins are withdrawable. Gameplay-earned coins cannot increase the SOL withdrawal cap.`, status: bankStatusForPlayer(freshPlayer) };
    if (coinBal < spendCoins) return { ok: false, reasonCode: "BANK_COINS_LOW", msg: `You have ${coinBal} gameplay coins available.` };

    const id = crypto.randomUUID?.() || `${Date.now()}:${p.id}`;
    const row: any = {
      id,
      withdrawalId: id,
      idempotencyKey: idem,
      playerId: p.id,
      wallet: p.wallet || "",
      to,
      token: s.token,
      tokenAddress: s.tokenAddress || (SOL_ADDR.test(String(s.token || "")) ? s.token : ""),
      tokenLabel: s.tokenLabel,
      amountRaw: amountRaw.toString(),
      amountUi: rawToUi(amountRaw, s.decimals),
      coinAmount: String(spendCoins),
      status: "pending",
      signature: null,
      createdAt: Date.now(),
      createdAtMs: Date.now(),
      debitedAt: Date.now(),
      sender: "rpc",
    };

    withImmediateTx(`bank.withdraw.request:${p.id}`, () => {
      const rowPlayer = getPlayer(p.id) as any || p;
      const before = Math.max(0, Math.floor(Number(rowPlayer?.inv?.g || 0)));
      rowPlayer.inv = { ...(rowPlayer.inv || {}), g: Math.max(0, before - spendCoins) };
      assertNonNegativeInventory(rowPlayer.inv);
      assertBankDeltaBalanced({ before: BigInt(before), after: BigInt(rowPlayer.inv.g || 0), debited: BigInt(spendCoins) });
      refreshPlayer(rowPlayer);
      appendCoinLedger({ player: p.id, delta: -spendCoins, reason: "bankCoinWithdrawalDebit", refType: "bankWithdrawal", refId: id, idempotencyKey: `withdraw-debit:${idem}`, meta: { amountRaw: amountRaw.toString(), amountUi: row.amountUi, coinAmount: spendCoins, to, coinsPerSol: s.coinsPerSol, principalBeforeRaw: principal.withdrawableRaw } });
      rows = withdrawals();
      rows.push(row);
      insertBankWithdrawal(row);
      saveWithdrawals(rows);
    });

    try {
      if (s.dryRunOnly) return { ok: true, withdrawal: row, status: bankStatusForPlayer(p), msg: `Withdrawal request created for ${row.amountUi} ${s.tokenLabel}. It will be sent when transfers are enabled.` };

      const sowl = await createBankClient();
      try {
        const result = await sowl.bank.sendToken({ token: s.token, from: s.bankWallet, to, amountRaw, sender: "rpc", live: true });
        row.status = "sent";
        row.signature = result?.signature || null;
        row.sentAt = Date.now();
        row.amountUi = result?.amountUi || row.amountUi;
        withImmediateTx(`bank.withdraw.sent:${p.id}`, () => { updateBankWithdrawal(row.id, { status: row.status, signature: row.signature, sentAt: row.sentAt, amountUi: row.amountUi }); saveWithdrawals(rows.map((r: any) => String(r.id) === String(row.id) ? row : r)); });
        return { ok: true, withdrawal: row, ...row, status: bankStatusForPlayer(p), msg: `Withdrawal sent: ${row.amountUi} ${s.tokenLabel}.` };
      } finally { sowl.close?.(); }
    } catch (e: any) {
      withImmediateTx(`bank.withdraw.refund:${p.id}`, () => {
        const rowPlayer = getPlayer(p.id) as any || p;
        const before = Math.max(0, Math.floor(Number(rowPlayer?.inv?.g || 0)));
        rowPlayer.inv = { ...(rowPlayer.inv || {}), g: before + spendCoins };
        assertNonNegativeInventory(rowPlayer.inv);
        assertBankDeltaBalanced({ before: BigInt(before), after: BigInt(rowPlayer.inv.g || 0), credited: BigInt(spendCoins) });
        refreshPlayer(rowPlayer);
        appendCoinLedger({ player: p.id, delta: spendCoins, reason: "bankCoinWithdrawalRefund", refType: "bankWithdrawal", refId: id, idempotencyKey: `withdraw-refund:${idem}`, meta: { amountRaw: amountRaw.toString(), amountUi: row.amountUi, coinAmount: spendCoins, error: String(e?.message || e) } });
        row.status = "failed";
        row.failedAt = Date.now();
        row.error = String(e?.message || e || "Token send failed");
        updateBankWithdrawal(row.id, { status: row.status, error: row.error, failedAt: row.failedAt });
        saveWithdrawals(rows.map((r: any) => String(r.id) === String(row.id) ? row : r));
      });
      recordBankError("withdraw", e, { playerId: p.id, to, amountUi: row.amountUi, idempotencyKey: idem });
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
          // New withdrawals debit the hard-currency ledger at request time.
          // Legacy queued rows without debitedAt are refused instead of touching
          // gameplay coins, because gameplay coins are soft currency.
          throw new Error(`Legacy pending withdrawal ${row.id} was not debited from the hard-currency ledger. Recreate the request with an idempotency key.`);
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