import { createMeasure } from "measure-fn";
import { metaGet, metaSet } from "./db";

const gateMeasure = createMeasure("login.gate", { maxResultLength: 180 });
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const META_LOGIN_GATE = "solcraft:login:tokenGate:v1";

export type LoginGateSettings = {
  enabled: boolean;
  tokenMint: string;
  tokenLabel: string;
  minUi: string;
  decimals: number;
  rpcEndpoint: string;
  message: string;
};

const DEFAULT_LOGIN_GATE: LoginGateSettings = {
  enabled: false,
  tokenMint: process.env.SOLCRAFTS_LOGIN_TOKEN_MINT || "",
  tokenLabel: process.env.SOLCRAFTS_LOGIN_TOKEN_LABEL || "$CRAFTS",
  minUi: process.env.SOLCRAFTS_LOGIN_MIN_UI || "1",
  decimals: Number(process.env.SOLCRAFTS_LOGIN_TOKEN_DECIMALS || "6") || 6,
  rpcEndpoint: process.env.RPC_ENDPOINT || process.env.SOLANA_RPC_ENDPOINT || "",
  message: "Hold the required SolCrafts token in your Phantom wallet to play.",
};

function validMint(v: string) {
  return SOL_ADDR.test(String(v || "").trim());
}

function sanitize(raw: any = {}): LoginGateSettings {
  const src = raw && typeof raw === "object" ? raw : {};
  const enabled = src.enabled == null ? DEFAULT_LOGIN_GATE.enabled : !!src.enabled;
  const tokenMint = String(src.tokenMint ?? src.mint ?? DEFAULT_LOGIN_GATE.tokenMint).trim();
  const tokenLabel = String(src.tokenLabel ?? src.label ?? DEFAULT_LOGIN_GATE.tokenLabel).trim().slice(0, 24) || "$CRAFTS";
  const decimals = Math.max(0, Math.min(12, Math.trunc(Number(src.decimals ?? DEFAULT_LOGIN_GATE.decimals) || 0)));
  const minUi = String(src.minUi ?? src.minimumUi ?? DEFAULT_LOGIN_GATE.minUi).trim() || "1";
  const rpcEndpoint = String(src.rpcEndpoint ?? DEFAULT_LOGIN_GATE.rpcEndpoint).trim();
  const message = String(src.message ?? DEFAULT_LOGIN_GATE.message).trim().slice(0, 240) || DEFAULT_LOGIN_GATE.message;
  return { enabled, tokenMint, tokenLabel, minUi, decimals, rpcEndpoint, message };
}

export function loginGateSettings(): LoginGateSettings {
  let raw: any = {};
  try { raw = JSON.parse(metaGet(META_LOGIN_GATE, "{}") || "{}"); } catch { raw = {}; }
  const settings = sanitize({ ...DEFAULT_LOGIN_GATE, ...raw });
  // Env token mint can enable the gate without an admin save.
  if (!settings.enabled && process.env.SOLCRAFTS_LOGIN_REQUIRE_TOKEN === "1") settings.enabled = true;
  return settings;
}

export function publicLoginGateSettings() {
  const s = loginGateSettings();
  return {
    enabled: !!s.enabled,
    configured: !!s.rpcEndpoint && validMint(s.tokenMint),
    tokenMint: s.tokenMint,
    tokenLabel: s.tokenLabel,
    minUi: s.minUi,
    decimals: s.decimals,
    message: s.message,
  };
}

export function setLoginGateSettings(patch: Partial<LoginGateSettings> = {}) {
  const cur = loginGateSettings();
  const next = sanitize({ ...cur, ...patch });
  metaSet(META_LOGIN_GATE, JSON.stringify(next));
  return { ok: true, loginGate: { ...publicLoginGateSettings(), ...next, rpcEndpoint: next.rpcEndpoint } };
}

function decimalToRaw(value: string, decimals: number): bigint {
  const clean = String(value || "0").trim().replace(/,/g, ".");
  const [wholeRaw, fracRaw = ""] = clean.split(".");
  const whole = BigInt((wholeRaw || "0").replace(/[^0-9]/g, "") || "0");
  const fracPadded = (fracRaw.replace(/[^0-9]/g, "") + "0".repeat(decimals)).slice(0, decimals);
  const frac = BigInt(fracPadded || "0");
  return whole * (10n ** BigInt(decimals)) + frac;
}

function rawToUi(raw: bigint, decimals: number) {
  if (decimals <= 0) return raw.toString();
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export async function walletTokenBalanceRaw(wallet: string, settings = loginGateSettings()) {
  const owner = String(wallet || "").trim();
  if (!SOL_ADDR.test(owner)) throw new Error("That doesn't look like a Solana wallet.");
  if (!validMint(settings.tokenMint)) throw new Error("Login token mint is not configured correctly.");
  if (!settings.rpcEndpoint) throw new Error("RPC endpoint is not configured for login token checks.");

  return gateMeasure.measure({
    start: () => `token balance ${owner.slice(0, 4)}… mint=${settings.tokenMint.slice(0, 4)}…`,
    end: (r: any) => ({ amountUi: r.amountUi, accounts: r.accounts }),
    budget: 400,
    maxResultLength: 120,
  }, async () => {
    const res = await fetch(settings.rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "solcraft-login-gate",
        method: "getTokenAccountsByOwner",
        params: [owner, { mint: settings.tokenMint }, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error?.message || res.statusText || "RPC token balance check failed.");
    const accounts = Array.isArray(json?.result?.value) ? json.result.value : [];
    let raw = 0n;
    for (const acc of accounts) {
      const amount = acc?.account?.data?.parsed?.info?.tokenAmount?.amount;
      if (amount != null && /^\d+$/.test(String(amount))) raw += BigInt(String(amount));
    }
    return { amountRaw: raw.toString(), amountUi: rawToUi(raw, settings.decimals), accounts: accounts.length };
  });
}

export async function checkWalletLoginGate(wallet: string) {
  const settings = loginGateSettings();
  if (!settings.enabled) return { ok: true, enabled: false, loginGate: publicLoginGateSettings() };
  const publicSettings = publicLoginGateSettings();
  if (!publicSettings.configured) {
    return { ok: false, reasonCode: "LOGIN_TOKEN_CONFIG", msg: "Login token gate is enabled but token mint/RPC endpoint is not configured.", loginGate: publicSettings };
  }
  try {
    const balance = await walletTokenBalanceRaw(wallet, settings);
    const have = BigInt(balance.amountRaw || "0");
    const need = decimalToRaw(settings.minUi, settings.decimals);
    const ok = have >= need;
    return {
      ok,
      reasonCode: ok ? "OK" : "LOGIN_TOKEN_REQUIRED",
      msg: ok ? "Token requirement met." : `You need at least ${settings.minUi} ${settings.tokenLabel} in this Phantom wallet to play. Current wallet has ${balance.amountUi} ${settings.tokenLabel}.`,
      loginGate: publicSettings,
      balance,
      requiredRaw: need.toString(),
      requiredUi: settings.minUi,
    };
  } catch (e: any) {
    return { ok: false, reasonCode: "LOGIN_TOKEN_CHECK_FAILED", msg: String(e?.message || e || "Could not verify token balance."), loginGate: publicSettings };
  }
}

export async function assertWalletPassesLoginGate(wallet: string) {
  const result = await checkWalletLoginGate(wallet);
  if (!result.ok) {
    const error: any = new Error(result.msg || "Token requirement failed.");
    error.reasonCode = result.reasonCode || "LOGIN_TOKEN_REQUIRED";
    error.details = result;
    throw error;
  }
  return result;
}