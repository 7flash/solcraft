export type GridCoord = { x: number; z: number };
export type PredictedMove = { seq: number; from: GridCoord; to: GridCoord; intent: GridCoord; sentAt: number; status: "pending" | "confirmed" | "rejected" };
export type ReconcileResult = { corrected: boolean; lerp: boolean; authoritative: GridCoord; predicted: GridCoord; pending: number };
function cloneCoord(v: GridCoord): GridCoord { return { x: Number(v.x || 0), z: Number(v.z || 0) }; }
function dist(a: GridCoord, b: GridCoord) { return Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.z || 0) - Number(b.z || 0)); }
export class MovementPredictor {
  private pending: PredictedMove[] = [];
  private nextSeq = 1;
  private lastConfirmedPos: GridCoord | null = null;
  constructor(private readonly maxPending = 4) {}
  reset(position?: GridCoord) { this.pending = []; if (position) this.lastConfirmedPos = cloneCoord(position); }
  predictMove(from: GridCoord, to: GridCoord, intent: GridCoord, now = performance.now()): PredictedMove {
    const move: PredictedMove = { seq: this.nextSeq++, from: cloneCoord(from), to: cloneCoord(to), intent: cloneCoord(intent), sentAt: now, status: "pending" };
    this.pending.push(move); return move;
  }
  canSendMore(limit = this.maxPending): boolean { return this.pending.filter((m) => m.status === "pending").length < Math.max(1, Number(limit || this.maxPending)); }
  pendingMoves(): readonly PredictedMove[] { return this.pending; }
  getCurrentPredictedPosition(): GridCoord | null { return this.pending.length ? cloneCoord(this.pending[this.pending.length - 1].to) : this.lastConfirmedPos ? cloneCoord(this.lastConfirmedPos) : null; }
  reconcile(serverPos: GridCoord, serverSeq?: number, options: { softTiles?: number; hardTiles?: number } = {}): ReconcileResult {
    const authoritative = cloneCoord(serverPos); this.lastConfirmedPos = authoritative;
    if (Number.isFinite(Number(serverSeq))) this.pending = this.pending.filter((m) => m.seq > Number(serverSeq) && m.status !== "rejected");
    const predicted = this.replayPending(authoritative);
    const current = this.getCurrentPredictedPosition() || authoritative;
    const d = dist(current, predicted);
    const softTiles = Math.max(0, Number(options.softTiles ?? 0.3));
    const hardTiles = Math.max(softTiles, Number(options.hardTiles ?? 1.5));
    if (d > hardTiles) { this.pending = []; return { corrected: true, lerp: false, authoritative, predicted: authoritative, pending: 0 }; }
    if (d > softTiles) return { corrected: true, lerp: true, authoritative, predicted, pending: this.pending.length };
    return { corrected: false, lerp: false, authoritative, predicted, pending: this.pending.length };
  }
  reject(seq: number, authoritative?: GridCoord) { this.pending = this.pending.filter((m) => m.seq < seq); if (authoritative) this.lastConfirmedPos = cloneCoord(authoritative); }
  private replayPending(base: GridCoord): GridCoord {
    let x = Number(base.x || 0), z = Number(base.z || 0);
    for (const move of this.pending) { x += Number(move.intent.x || 0); z += Number(move.intent.z || 0); move.from = { x: x - Number(move.intent.x || 0), z: z - Number(move.intent.z || 0) }; move.to = { x, z }; }
    return { x, z };
  }
}
