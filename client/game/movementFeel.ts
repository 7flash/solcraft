export type HopDurationInput = {
  projectedDistance: number;
  referenceDistance: number;
  baseSeconds?: number;
  minScale?: number;
  maxScale?: number;
};

export const DEFAULT_HOP_SECONDS = 0.16;
export const DEFAULT_HOP_MAX_SCALE = 1.75;

function finitePositive(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function hopDurationForProjectedDistance(input: HopDurationInput): number {
  const base = finitePositive(input.baseSeconds, DEFAULT_HOP_SECONDS);
  const projected = finitePositive(input.projectedDistance, 0);
  const reference = finitePositive(input.referenceDistance, 0);
  if (!projected || !reference) return base;

  const minScale = Math.max(0.5, Number(input.minScale ?? 1));
  const maxScale = Math.max(minScale, Number(input.maxScale ?? DEFAULT_HOP_MAX_SCALE));
  const rawScale = projected / reference;
  const scale = Math.max(minScale, Math.min(maxScale, rawScale));
  return base * scale;
}

export function movementFeelBucket(projectedDistance: number, referenceDistance: number): "normal" | "long-screen-step" | "invalid" {
  const projected = Number(projectedDistance);
  const reference = Number(referenceDistance);
  if (!Number.isFinite(projected) || !Number.isFinite(reference) || projected <= 0 || reference <= 0) return "invalid";
  return projected > reference * 1.18 ? "long-screen-step" : "normal";
}
export function gridStepDistance(dx: number, dz: number): number {
  const x = Number(dx || 0);
  const z = Number(dz || 0);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  return Math.sqrt(x * x + z * z);
}

export function normalizeStepDuration(dx: number, dz: number, baseSeconds = DEFAULT_HOP_SECONDS): number {
  const dist = gridStepDistance(dx, dz);
  if (!dist) return baseSeconds;
  return baseSeconds * Math.max(1, dist);
}

export function normalizeStepCost(dx: number, dz: number, baseCost: number): number {
  const cost = Math.max(0, Number(baseCost || 0));
  const dist = gridStepDistance(dx, dz);
  return cost * Math.max(1, dist || 1);
}
