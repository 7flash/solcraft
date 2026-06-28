export type MoveIntent = { x: number; z: number };
export type MovementAccumulatorOptions = {
  stepMs?: number;
  directionBoostRatio?: number;
  maxStepsPerTick?: number;
  accelPerSecond?: number;
  decelPerSecond?: number;
};

function sameIntent(a: MoveIntent, b: MoveIntent) {
  return Number(a.x || 0) === Number(b.x || 0) && Number(a.z || 0) === Number(b.z || 0);
}
function cloneIntent(v: MoveIntent): MoveIntent { return { x: Number(v.x || 0), z: Number(v.z || 0) }; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function approach(current: number, target: number, amount: number) {
  const d = target - current;
  if (Math.abs(d) <= amount) return target;
  return current + Math.sign(d) * amount;
}
function normalizeIntent(v: MoveIntent): MoveIntent {
  const x = Math.max(-1, Math.min(1, Math.trunc(Number(v.x || 0))));
  const z = Math.max(-1, Math.min(1, Math.trunc(Number(v.z || 0))));
  return { x, z };
}

export class MovementAccumulator {
  private accMs = 0;
  private lastTickMs = 0;
  private desired: MoveIntent = { x: 0, z: 0 };
  private smoothed: MoveIntent = { x: 0, z: 0 };
  private lastIssued: MoveIntent = { x: 0, z: 0 };
  private readonly stepMs: number;
  private readonly directionBoostRatio: number;
  private readonly maxStepsPerTick: number;
  private readonly accelPerSecond: number;
  private readonly decelPerSecond: number;

  constructor(options: MovementAccumulatorOptions = {}) {
    this.stepMs = Math.max(1, Number(options.stepMs || 132));
    this.directionBoostRatio = Math.max(0, Math.min(1, Number(options.directionBoostRatio ?? 0.35)));
    this.maxStepsPerTick = Math.max(1, Math.min(8, Math.floor(Number(options.maxStepsPerTick || 2))));
    this.accelPerSecond = Math.max(0.1, Number(options.accelPerSecond ?? 9.5));
    this.decelPerSecond = Math.max(0.1, Number(options.decelPerSecond ?? 14));
  }

  setIntent(intent: MoveIntent) { this.desired = normalizeIntent(intent); }
  getIntent(): MoveIntent { return cloneIntent(this.desired); }
  getVelocity(): MoveIntent { return cloneIntent(this.smoothed); }

  reset(now = 0) {
    this.accMs = 0;
    this.lastTickMs = Number(now || 0);
    this.desired = { x: 0, z: 0 };
    this.smoothed = { x: 0, z: 0 };
    this.lastIssued = { x: 0, z: 0 };
  }

  stop(now = 0) {
    this.accMs = 0;
    this.lastTickMs = Number(now || this.lastTickMs || 0);
    this.desired = { x: 0, z: 0 };
  }

  private updateVelocity(dtMs: number) {
    const dt = Math.max(0, Math.min(0.25, dtMs / 1000));
    const desiredMag = Math.hypot(this.desired.x, this.desired.z);
    const rate = desiredMag > 0 ? this.accelPerSecond : this.decelPerSecond;
    const amount = rate * dt;
    this.smoothed.x = clamp(approach(this.smoothed.x, this.desired.x, amount), -1, 1);
    this.smoothed.z = clamp(approach(this.smoothed.z, this.desired.z, amount), -1, 1);
  }

  tick(now: number, canIssue: () => boolean, issue: (intent: MoveIntent) => void): number {
    const t = Number(now || 0);
    const dt = this.lastTickMs ? Math.max(0, Math.min(250, t - this.lastTickMs)) : 0;
    this.lastTickMs = t;
    this.updateVelocity(dt);

    if (!this.desired.x && !this.desired.z) {
      this.accMs = 0;
      return 0;
    }

    const speed = Math.min(1, Math.hypot(this.smoothed.x, this.smoothed.z));
    if (speed < 0.18) return 0;

    // Acceleration affects first-step feel without changing server movement:
    // the issued move is still one ECS tile, but cadence ramps in smoothly.
    this.accMs += dt * (0.65 + speed * 0.35);
    const directionChanged = !sameIntent(this.desired, this.lastIssued);
    const boostThreshold = this.stepMs * this.directionBoostRatio;
    if (directionChanged && this.accMs >= boostThreshold) this.accMs = Math.max(this.accMs, this.stepMs);

    let issued = 0;
    while (this.accMs >= this.stepMs && issued < this.maxStepsPerTick && canIssue()) {
      this.accMs -= this.stepMs;
      this.lastIssued = cloneIntent(this.desired);
      issue(this.lastIssued);
      issued++;
    }
    return issued;
  }
}

export function createMovementAccumulator(options: MovementAccumulatorOptions = {}) {
  return new MovementAccumulator(options);
}
