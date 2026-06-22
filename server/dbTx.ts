// @ts-nocheck
import { db } from "./db";

let txDepth = 0;

function safeRollback() { try { db.exec("ROLLBACK"); } catch {} }

export function withImmediateTx<T>(label: string, fn: () => T): T {
  if (txDepth > 0) return fn();
  txDepth++;
  try {
    db.exec("BEGIN IMMEDIATE");
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e: any) {
    safeRollback();
    const msg = String(e?.message || e || "transaction failed");
    if (!e?.reasonCode && /unique constraint|constraint failed|SQLITE_CONSTRAINT/i.test(msg)) e.reasonCode = "WRITE_CONFLICT";
    if (!e?.txLabel) e.txLabel = label;
    throw e;
  } finally {
    txDepth = Math.max(0, txDepth - 1);
  }
}

export async function withImmediateTxAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (txDepth > 0) return await fn();
  txDepth++;
  try {
    db.exec("BEGIN IMMEDIATE");
    const out = await fn();
    db.exec("COMMIT");
    return out;
  } catch (e: any) {
    safeRollback();
    const msg = String(e?.message || e || "transaction failed");
    if (!e?.reasonCode && /unique constraint|constraint failed|SQLITE_CONSTRAINT/i.test(msg)) e.reasonCode = "WRITE_CONFLICT";
    if (!e?.txLabel) e.txLabel = label;
    throw e;
  } finally {
    txDepth = Math.max(0, txDepth - 1);
  }
}
