/**
 * How the off-chain bank wires into the bridge. This REPLACES the trust-weak
 * parts of bank.ts: the server no longer "sends tokens" with a hot wallet
 * holding the treasury — it authorizes a capped, idempotent on-chain release.
 *
 * request_id is the bridge's idempotency key. Derive it deterministically from
 * the off-chain withdrawal row so a retry produces the SAME request_id and the
 * receipt PDA collision aborts the duplicate before any transfer.
 */
import { createHash } from "node:crypto";

export function withdrawalRequestId(offChainWithdrawalId: string, playerId: number): Uint8Array {
  // 32 bytes, deterministic per off-chain withdrawal row.
  return new Uint8Array(
    createHash("sha256")
      .update(`solcraft:wd:${playerId}:${offChainWithdrawalId}`)
      .digest()
  );
}

/**
 * requestBankWithdrawal (rewritten shape):
 *
 *   1. Off-chain, inside one SQLite tx: check inv.g, debit it, insert the
 *      bankWithdrawals row with status="pending" and a unique withdrawalId.
 *      (This is your existing idempotency, now mirrored on-chain.)
 *   2. Build + sign the bridge `withdraw` tx with withdraw_authority:
 *        request_id = withdrawalRequestId(row.withdrawalId, p.id)
 *        amount     = decimalToRaw(amountUi, decimals)   // already integer raw
 *      The epoch cap is enforced ON-CHAIN — do not re-implement it off-chain;
 *      just surface EpochCapExceeded back to the player as "try again later."
 *   3. On confirmed sig: update row status="sent", signature=sig.
 *      On EpochCapExceeded or any failure: refund inv.g, status="failed".
 *
 * The two idempotency layers compose: the SQLite uniq index stops a double
 * *request*; the receipt PDA stops a double *payout* even if the server retries
 * the tx. Neither can be bypassed by a bug in the other.
 *
 * Rounding: pass integer raw `amount` end to end. Do NOT floor on credit and
 * ceil on debit (the current dust leak). The vault is the single source of
 * truth for raw token balance.
 */

/**
 * Deposit side: drop sowl's per-player deposit-wallet generation entirely.
 * The client calls the bridge `deposit(player_id, amount)` against the single
 * vault. Your indexer subscribes to DepositEvent and credits inv.g once per
 * (signature) — keep a processed-signatures set so re-indexing is idempotent,
 * exactly like scanBankDeposits already does with seen signatures.
 */
