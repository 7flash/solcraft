/**
 * Central feature gates for stabilizing the core game without deleting legacy systems.
 * Wire these into UI/menu visibility first, then into action guards once parity tests exist.
 */
export const FEATURE_FLAGS = {
  coreEcsGameplay: false,
  walletLogin: true,
  bank: true,
  redeem: true,
  wonders: true,
  atlasStudio: true,
  audioRuntime: true,
  adminTools: true,
  bombsAndSiege: true,
  trade: true,
  chat: true,
  skills: true,
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

export function featureEnabled(name: FeatureFlagName, env: Record<string, string | undefined> = process.env): boolean {
  const raw = env[`SOLCRAFT_FEATURE_${name}`] ?? env[`NEXT_PUBLIC_SOLCRAFT_FEATURE_${name}`];
  if (raw == null || raw === "") return FEATURE_FLAGS[name];
  return /^(1|true|yes|on)$/i.test(String(raw));
}
