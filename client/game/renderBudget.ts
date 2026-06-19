export type RenderMotionMode = "smooth" | "classic" | "low" | string;

export type PerfSample = {
  slowFrames: number;
  totalFrames: number;
  slowRatioThreshold?: number;
  minFrames?: number;
};

/**
 * Keep the renderer on requestAnimationFrame for normal modes.
 * "Classic" is camera feel only; it must not cap rendering below 60fps.
 * Only the explicit low-motion mode may intentionally reduce frame rate.
 */
export function frameThrottleMsForMotion(motion: RenderMotionMode): number {
  return motion === "low" ? 33 : 0;
}

/**
 * Enter emergency perf mode only after enough samples prove the client is missing
 * the 60fps budget repeatedly. A 22ms frame is already below ~45fps.
 */
export function shouldEnterPerfMode(sample: PerfSample): boolean {
  const total = Math.max(0, Math.trunc(Number(sample.totalFrames || 0)));
  const minFrames = Math.max(1, Math.trunc(Number(sample.minFrames ?? 120)));
  if (total < minFrames) return false;
  const slow = Math.max(0, Math.trunc(Number(sample.slowFrames || 0)));
  const threshold = Math.max(0, Math.min(1, Number(sample.slowRatioThreshold ?? 0.28)));
  return slow / total >= threshold;
}
