// @ts-nocheck
import { api } from "./httpClient";

export function shortWallet(addr: string) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "Not connected";
}

function bytesToBase64(bytes: any) {
  let s = "";
  const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

export function phantomProvider() {
  const w = typeof window !== "undefined" ? window : {};
  const p = w.phantom?.solana || w.solana;
  return p?.isPhantom ? p : null;
}

export async function loadLoginGateConfig() {
  const cfg = await api("/api/auth/config");
  if (cfg?.ok && cfg.loginGate) return cfg.loginGate;
  return null;
}

export function loginGateText(gate: any) {
  if (!gate?.enabled) return "No token gate configured for this world.";
  if (!gate.configured) return "Token gate is enabled, but admin must configure token mint and RPC endpoint.";
  return `Requires at least ${gate.minUi || 1} ${gate.tokenLabel || "$CRAFTS"} in your Phantom wallet.`;
}

export async function connectAndSignPhantom() {
  const provider = phantomProvider();
  if (!provider) throw new Error("Phantom wallet was not found. Install Phantom or enable the extension, then try again. You can still use Spectate read-only without a wallet.");
  const conn = await provider.connect();
  const wallet = (conn?.publicKey || provider.publicKey)?.toString?.();
  if (!wallet) throw new Error("Phantom did not return a Solana wallet.");
  const tokenCheck = await api("/api/auth/token-check", { wallet });
  if (!tokenCheck?.ok) throw new Error(tokenCheck?.msg || "This wallet does not meet the token requirement.");
  const challenge = await api("/api/auth/challenge", { wallet });
  if (!challenge?.ok) throw new Error(challenge?.msg || "Could not create wallet challenge.");
  const encoded = new TextEncoder().encode(challenge.message);
  const signed = await provider.signMessage(encoded, "utf8");
  const signature = bytesToBase64(signed.signature || signed);
  return { wallet, message: challenge.message, signature, loginGate: tokenCheck?.loginGate || challenge?.loginGate || null };
}
