import { db } from "./db";
import { getPlayer, refreshPlayer } from "./playerStore";

export type LiveMovementState = {
  id: number;
  x: number;
  z: number;
  energy?: number;
  energyAt?: number;
  lastSeq: number;
  updatedAt: number;
  dirty: boolean;
};

const livePositions = new Map<number, LiveMovementState>();

function int(v: any, fallback = 0) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
}
function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function idOf(v: any) {
  const n = int(v, 0);
  return n > 0 ? n : 0;
}

export function liveMovementStats() {
  let dirty = 0;
  for (const s of livePositions.values()) if (s.dirty) dirty++;
  return { live: livePositions.size, dirty };
}

export function liveMovementFor(playerIdLike: any): LiveMovementState | null {
  const id = idOf(playerIdLike);
  return id ? livePositions.get(id) || null : null;
}

export function liveMovementRow<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row) return row;
  const live = liveMovementFor((row as any).id);
  if (!live) return row;
  return {
    ...(row as any),
    x: live.x,
    z: live.z,
    energy: live.energy ?? (row as any).energy,
    energyAt: live.energyAt ?? (row as any).energyAt,
    updatedAt: Math.max(num((row as any).updatedAt, 0), live.updatedAt),
    lastSeen: Math.max(num((row as any).lastSeen, 0), live.updatedAt),
    moveSeq: live.lastSeq,
  } as T;
}

export function liveMovementRows<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => liveMovementRow(row) as T);
}

export function commitLiveMovement(rowLike: Record<string, any>, next: { x: number; z: number; energy?: number; energyAt?: number; seq?: number; at?: number }) {
  const id = idOf(rowLike?.id);
  if (!id) return null;
  const prev = livePositions.get(id);
  const at = num(next.at, Date.now());
  const state: LiveMovementState = {
    id,
    x: int(next.x, int(prev?.x ?? rowLike.x, 0)),
    z: int(next.z, int(prev?.z ?? rowLike.z, 0)),
    energy: next.energy === undefined ? (prev?.energy ?? (Number.isFinite(Number(rowLike.energy)) ? Number(rowLike.energy) : undefined)) : Math.max(0, Number(next.energy || 0)),
    energyAt: next.energyAt === undefined ? (prev?.energyAt ?? (Number.isFinite(Number(rowLike.energyAt)) ? Number(rowLike.energyAt) : undefined)) : num(next.energyAt, at),
    lastSeq: Math.max(int(prev?.lastSeq || 0), int(next.seq || 0)),
    updatedAt: at,
    dirty: true,
  };
  livePositions.set(id, state);
  return state;
}

export function flushLiveMovementForPlayer(playerIdLike: any) {
  const id = idOf(playerIdLike);
  const live = id ? livePositions.get(id) : null;
  if (!live || !live.dirty) return false;
  const row = getPlayer(id) as any;
  if (!row) { livePositions.delete(id); return false; }
  row.x = live.x;
  row.z = live.z;
  if (live.energy !== undefined) row.energy = live.energy;
  if (live.energyAt !== undefined) row.energyAt = live.energyAt;
  row.lastSeen = Math.max(num(row.lastSeen, 0), live.updatedAt);
  row.updatedAt = Math.max(num(row.updatedAt, 0), live.updatedAt);
  refreshPlayer(row);
  live.dirty = false;
  livePositions.set(id, live);
  return true;
}

export function flushLiveMovementToDb(limit = 500) {
  let flushed = 0;
  for (const live of [...livePositions.values()].sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (flushed >= limit) break;
    if (!live.dirty) continue;
    if (flushLiveMovementForPlayer(live.id)) flushed++;
  }
  return { ok: true, flushed, ...liveMovementStats() };
}
