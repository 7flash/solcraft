/**
 * Server-only feature gates for the clean ECS release.
 *
 * Do not read browser-prefixed env values here. Static browser boot options are
 * injected by app/page.tsx into window.__SOLCRAFT_CONFIG__; gameplay gates are
 * server authority only.
 */
export const FEATURE_FLAGS = {
  coreEcsGameplay: true,
  walletLogin: true,
  bank: true,
  redeem: false,
  wonders: true,
  atlasStudio: true,
  audioRuntime: true,
  adminTools: true,
  bombsAndSiege: false,
  trade: false,
  chat: true,
  skills: false,
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

export function featureEnabled(name: FeatureFlagName, env: Record<string, string | undefined> = process.env): boolean {
  const raw = env[`SOLCRAFT_FEATURE_${name}`];
  if (raw == null || raw === '') return FEATURE_FLAGS[name];
  return /^(1|true|yes|on)$/i.test(String(raw));
}
