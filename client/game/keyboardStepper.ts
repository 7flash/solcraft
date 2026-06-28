export type KeyboardStepSnapshot = {
  nowMs: number;
  lastStepMs: number;
  minStepMs?: number;
};

export type SmoothedKeyboardVector = {
  x: number;
  z: number;
  speed: number;
  active: boolean;
};

// Visual movement now eases between authoritative ECS cells, so keyboard input
// can issue slightly faster without looking like tile teleporting. The server
// still owns validity, collision, and energy cost for each step.
export const DEFAULT_KEYBOARD_STEP_MS = 126;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp(t, 0, 1); }

/**
 * Keyboard movement must be cadence-based, not browser-repeat based. Some
 * browsers repeat left/right keys at a slightly different cadence than up/down;
 * this helper normalizes all directions so horizontal movement cannot burst.
 */
export function canIssueKeyboardStep(s: KeyboardStepSnapshot): boolean {
  const min = Math.max(0, Number(s.minStepMs ?? DEFAULT_KEYBOARD_STEP_MS));
  const now = Number(s.nowMs || 0);
  const last = Number(s.lastStepMs || 0);
  return !last || now - last >= min;
}

export function nextKeyboardStepAt(lastStepMs: number, minStepMs = DEFAULT_KEYBOARD_STEP_MS): number {
  return Math.max(0, Number(lastStepMs || 0)) + Math.max(0, Number(minStepMs || 0));
}

/**
 * Small helper for render/input controllers that want analog-feeling keyboard
 * motion while still issuing discrete ECS tile moves. The returned vector is
 * floating-point and should only drive animation/camera/preview, not authority.
 */
export function smoothKeyboardVector(
  previous: SmoothedKeyboardVector,
  desired: { x: number; z: number },
  dtMs: number,
  accel = 13,
  decel = 18,
): SmoothedKeyboardVector {
  const dt = Math.max(0, Math.min(0.25, Number(dtMs || 0) / 1000));
  const active = !!(desired.x || desired.z);
  const rate = active ? accel : decel;
  const t = 1 - Math.exp(-rate * dt);
  const x = lerp(Number(previous?.x || 0), clamp(Number(desired.x || 0), -1, 1), t);
  const z = lerp(Number(previous?.z || 0), clamp(Number(desired.z || 0), -1, 1), t);
  return { x, z, speed: Math.min(1, Math.hypot(x, z)), active };
}
