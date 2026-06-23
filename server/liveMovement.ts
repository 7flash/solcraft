// Compatibility shim for older imports. Live movement now lives inside the
// resident ECS world runtime, not in a separate database overlay.
import {
  commitResidentMovement,
  residentMovementFor,
  residentPlayerRow,
  residentPlayerRows,
  residentWorldStatus,
  checkpointResidentWorld,
} from "./residentWorld";

export type LiveMovementState = ReturnType<typeof residentMovementFor> extends infer T ? NonNullable<T> : any;

export function liveMovementStats() {
  const s = residentWorldStatus() as any;
  return { live: s.players || 0, dirty: s.dirtyMoves || 0, resident: true, worldRev: s.rev || 0 };
}

export function liveMovementFor(playerIdLike: any) { return residentMovementFor(playerIdLike); }
export function liveMovementRow<T extends Record<string, any> | null | undefined>(row: T): T { return residentPlayerRow(row); }
export function liveMovementRows<T extends Record<string, any>>(rows: T[]): T[] { return residentPlayerRows(rows); }
export function commitLiveMovement(rowLike: Record<string, any>, next: { x: number; z: number; energy?: number; energyAt?: number; seq?: number; at?: number }) { return commitResidentMovement(rowLike, next); }

export function flushLiveMovementForPlayer(_playerIdLike: any) {
  // No per-move DB write. Non-movement actions should read through
  // residentPlayerRow() so they see the current in-memory position.
  return false;
}

export function flushLiveMovementToDb(_limit = 500) {
  // Keep old call sites harmless: save a whole resident world snapshot instead
  // of syncing movement rows to sqlite.
  return checkpointResidentWorld("movement-compat-flush");
}
