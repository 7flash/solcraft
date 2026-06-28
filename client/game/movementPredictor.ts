export type GridCoord = { x: number; z: number };
export type PredictedMove = { seq: number; from: GridCoord; to: GridCoord; intent: GridCoord; sentAt: number; status: "pending" | "confirmed" | "rejected" };
export type ReconcileOptions = {
  softTiles?: number;
  hardTiles?: number;
  visualPosition?: GridCoord | null;
  now?: number;
  softMs?: number;
};
export type ReconcileResult = {
  corrected: boolean;
  lerp: boolean;
  hard: boolean;
  suppressPop: boolean;
  authoritative: GridCoord;
  predicted: GridCoord;
  visual: GridCoord;
  pending: number;
  drift: number;
  visualDrift: number;
  correctionStrength: number;
};
export type PredictMoveOptions = number | { now?: number; seq?: number };

function cloneCoord(v: GridCoord): GridCoord { return { x: Number(v.x || 0), z: Number(v.z || 0) }; }
function dist(a: GridCoord, b: GridCoord) { return Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.z || 0) - Number(b.z || 0)); }
function finite(value: unknown, fallback: number) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

export class MovementPredictor {
  private pending: PredictedMove[] = [];
  private nextSeq = 1;
  private lastConfirmedPos: GridCoord | null = null;
  private lastCorrectionAt = 0;

  constructor(private readonly maxPending = 4) {}

  reset(position?: GridCoord) {
    this.pending = [];
    if (position) this.lastConfirmedPos = cloneCoord(position);
    this.lastCorrectionAt = 0;
  }

  predictMove(from: GridCoord, to: GridCoord, intent: GridCoord, opts: PredictMoveOptions = performance.now()): PredictedMove {
    const explicitSeq = typeof opts === "object" && opts ? Number(opts.seq) : NaN;
    const now = typeof opts === "object" && opts ? Number(opts.now ?? performance.now()) : Number(opts || performance.now());
    const seq = Number.isFinite(explicitSeq) && explicitSeq > 0 ? explicitSeq : this.nextSeq++;
    this.nextSeq = Math.max(this.nextSeq, seq + 1);
    const move: PredictedMove = { seq, from: cloneCoord(from), to: cloneCoord(to), intent: cloneCoord(intent), sentAt: now, status: "pending" };
    this.pending.push(move);
    return move;
  }

  confirmThrough(seq: number) {
    const n = Number(seq || 0);
    if (!Number.isFinite(n) || n <= 0) return;
    this.pending = this.pending.filter((m) => m.seq > n && m.status !== "rejected");
  }

  canSendMore(limit = this.maxPending): boolean {
    return this.pending.filter((m) => m.status === "pending").length < Math.max(1, Number(limit || this.maxPending));
  }

  pendingMoves(): readonly PredictedMove[] { return this.pending; }

  getCurrentPredictedPosition(): GridCoord | null {
    return this.pending.length ? cloneCoord(this.pending[this.pending.length - 1].to) : this.lastConfirmedPos ? cloneCoord(this.lastConfirmedPos) : null;
  }

  /**
   * Replays pending moves over the latest authoritative server position and
   * returns enough detail for the renderer to choose between soft visual
   * correction and a true rubber-band snap. This intentionally uses visual
   * distance when provided, because small logical tile mismatches are only
   * noticeable when they pop the rendered character.
   */
  reconcile(serverPos: GridCoord, serverSeq?: number, options: ReconcileOptions = {}): ReconcileResult {
    const now = finite(options.now, typeof performance !== "undefined" ? performance.now() : 0);
    const authoritative = cloneCoord(serverPos);
    this.lastConfirmedPos = authoritative;
    if (Number.isFinite(Number(serverSeq))) this.confirmThrough(Number(serverSeq));

    const beforeReplay = this.getCurrentPredictedPosition() || authoritative;
    const predicted = this.replayPending(authoritative);
    const logicalDrift = dist(beforeReplay, predicted);
    const visual = options.visualPosition ? cloneCoord(options.visualPosition) : beforeReplay;
    const visualDrift = dist(visual, predicted);

    const softTiles = Math.max(0, Number(options.softTiles ?? 0.08));
    const hardTiles = Math.max(softTiles, Number(options.hardTiles ?? 2.5));
    const softMs = Math.max(16, Number(options.softMs ?? 140));
    const since = this.lastCorrectionAt ? Math.max(0, now - this.lastCorrectionAt) : softMs;
    const timeFactor = Math.max(0.18, Math.min(1, since / softMs));
    const correctionStrength = Math.min(0.65, Math.max(0.08, (visualDrift / 1.8) * 0.35 + 0.16) * timeFactor);
    const hard = visualDrift > hardTiles || logicalDrift > hardTiles + 0.5;
    const suppressPop = visualDrift > 0 && visualDrift < 0.12;
    const corrected = hard || visualDrift > softTiles || logicalDrift > softTiles;
    const lerp = corrected && !hard && !suppressPop;

    if (hard) this.pending = [];
    if (corrected) this.lastCorrectionAt = now;

    return {
      corrected,
      lerp,
      hard,
      suppressPop,
      authoritative,
      predicted: hard ? authoritative : predicted,
      visual,
      pending: this.pending.length,
      drift: logicalDrift,
      visualDrift,
      correctionStrength,
    };
  }

  reject(seq: number, authoritative?: GridCoord) {
    this.pending = this.pending.filter((m) => m.seq < seq);
    if (authoritative) this.lastConfirmedPos = cloneCoord(authoritative);
  }

  pendingCount(): number { return this.pending.length; }

  private replayPending(base: GridCoord): GridCoord {
    let x = Number(base.x || 0), z = Number(base.z || 0);
    for (const move of this.pending) {
      x += Number(move.intent.x || 0);
      z += Number(move.intent.z || 0);
      move.from = { x: x - Number(move.intent.x || 0), z: z - Number(move.intent.z || 0) };
      move.to = { x, z };
    }
    return { x, z };
  }
}
