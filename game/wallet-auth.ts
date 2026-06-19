import { createPublicKey, randomBytes, verify as verifyEd25519 } from "node:crypto";
import { db } from "./db";

const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export type WalletAuthInput = {
  wallet: string;
  message: string;
  signature: string; // base64-encoded Uint8Array from Phantom signMessage
};

function base58Decode(value: string): Uint8Array {
  let n = 0n;
  for (const ch of value) {
    const digit = BASE58_ALPHABET.indexOf(ch);
    if (digit < 0) throw new Error("invalid base58");
    n = n * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 255n));
    n >>= 8n;
  }
  bytes.reverse();
  for (const ch of value) {
    if (ch === "1") bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

export function normalizeWallet(wallet: string): string {
  const w = String(wallet || "").trim();
  if (!SOL_ADDR.test(w)) throw new Error("That doesn't look like a Solana wallet.");
  const raw = base58Decode(w);
  if (raw.length !== 32) throw new Error("That Solana wallet is not a 32-byte public key.");
  return w;
}

export function createWalletChallenge(wallet: string) {
  const w = normalizeWallet(wallet);
  const nonce = randomBytes(16).toString("hex");
  const message = [
    "SolCraft wants you to sign in with your Solana wallet.",
    "",
    "This request will not trigger a blockchain transaction or cost gas.",
    `Wallet: ${w}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    "Action: Create or authorize the same SolCraft account",
  ].join("\n");

  db.walletChallenges.insert({ wallet: w, nonce, message, used: 0 });
  return { wallet: w, nonce, message };
}

export function verifyWalletAuth(input: WalletAuthInput): string {
  if (!input || !input.wallet || !input.message || !input.signature) throw new Error("Connect Phantom and sign the login message first.");
  const wallet = normalizeWallet(input.wallet);
  const nonce = /Nonce:\s*([a-f0-9]{32})/i.exec(input.message)?.[1];
  if (!nonce) throw new Error("Login challenge is missing a nonce.");

  const row = db.walletChallenges.select().where({ wallet, nonce, used: 0 }).first() as any;
  if (!row || row.message !== input.message) throw new Error("Login challenge expired. Try again.");
  const createdAt = Date.parse(row.createdAt || row.updatedAt || "");
  if (!createdAt || Date.now() - createdAt > CHALLENGE_TTL_MS) {
    row.used = 1;
    throw new Error("Login challenge expired. Try again.");
  }

  const publicKey = Buffer.from(base58Decode(wallet));
  const signature = Buffer.from(String(input.signature), "base64");
  if (signature.length !== 64) throw new Error("Invalid Phantom signature.");
  const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]), format: "der", type: "spki" });
  const ok = verifyEd25519(null, Buffer.from(input.message, "utf8"), key, signature);
  row.used = 1; // one signature per challenge; prevents replay
  if (!ok) throw new Error("Phantom signature did not match that wallet.");
  return wallet;
}
