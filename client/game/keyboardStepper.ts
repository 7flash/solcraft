export type KeyboardStepSnapshot = {
  nowMs: number;
  lastStepMs: number;
  minStepMs?: number;
};

export const DEFAULT_KEYBOARD_STEP_MS = 158;

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
