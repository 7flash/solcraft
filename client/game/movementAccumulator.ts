export type MoveIntent = { x: number; z: number };
export type MovementAccumulatorOptions = {
  stepMs?: number;
  directionBoostRatio?: number;
  maxStepsPerTick?: number;
};

function sameIntent(a: MoveIntent, b: MoveIntent) {
  return Number(a.x || 0) === Number(b.x || 0) && Number(a.z || 0) === Number(b.z || 0);
}
function cloneIntent(v: MoveIntent): MoveIntent { return { x: Number(v.x || 0), z: Number(v.z || 0) }; }

export class MovementAccumulator {
  private accMs = 0;
  private lastTickMs = 0;
  private current: MoveIntent = { x: 0, z: 0 };
  private lastIssued: MoveIntent = { x: 0, z: 0 };
  private readonly stepMs: number;
  private readonly directionBoostRatio: number;
  private readonly maxStepsPerTick: number;

  constructor(options: MovementAccumulatorOptions = {}) {
    this.stepMs = Math.max(1, Number(options.stepMs || 158));
    this.directionBoostRatio = Math.max(0, Math.min(1, Number(options.directionBoostRatio ?? 0.4)));
    this.maxStepsPerTick = Math.max(1, Math.min(8, Math.floor(Number(options.maxStepsPerTick || 2))));
  }

  setIntent(intent: MoveIntent) { this.current = cloneIntent(intent); }
  getIntent(): MoveIntent { return cloneIntent(this.current); }
  reset(now = 0) { this.accMs = 0; this.lastTickMs = Number(now || 0); this.current = { x: 0, z: 0 }; this.lastIssued = { x: 0, z: 0 }; }
  stop(now = 0) { this.accMs = 0; this.lastTickMs = Number(now || this.lastTickMs || 0); this.current = { x: 0, z: 0 }; }

  tick(now: number, canIssue: () => boolean, issue: (intent: MoveIntent) => void): number {
    const t = Number(now || 0);
    const dt = this.lastTickMs ? Math.max(0, Math.min(250, t - this.lastTickMs)) : 0;
    this.lastTickMs = t;
    if (!this.current.x && !this.current.z) { this.accMs = 0; return 0; }
    this.accMs += dt;
    const directionChanged = !sameIntent(this.current, this.lastIssued);
    const boostThreshold = this.stepMs * this.directionBoostRatio;
    if (directionChanged && this.accMs >= boostThreshold) this.accMs = Math.max(this.accMs, this.stepMs);
    let issued = 0;
    while (this.accMs >= this.stepMs && issued < this.maxStepsPerTick && canIssue()) {
      this.accMs -= this.stepMs;
      this.lastIssued = cloneIntent(this.current);
      issue(this.lastIssued);
      issued++;
    }
    return issued;
  }
}

export function createMovementAccumulator(options: MovementAccumulatorOptions = {}) {
  return new MovementAccumulator(options);
}
