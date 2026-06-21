// @ts-nocheck
/** @jsxImportSource tradjs/client */

export const PROCEDURAL_ICON: Record<string, string> = {
  axe: "🪓", wood: "🪓", pickaxe: "⛏", stone: "⛏", hammer: "🔨", build: "🔨", shovel: "▰", demolish: "▰", sword: "⚔", attack: "⚔", capture: "⚑", claim: "⚑",
  settings: "⚙", sound: "♪", logout: "↩", exit: "↩", energy: "⚡", gold: "●", heart: "♥", walk: "↗", inspect: "⌕", interact: "◆", wait: "…",
};

export function UiIcon({ name, fallback = "•" }: any) {
  const safeName = String(name || "x").toLowerCase();
  const glyph = PROCEDURAL_ICON[safeName] || fallback || "•";
  return <span className={`ui-ico ui-ico-proc ui-ico-${safeName}`} aria-hidden="true"><span>{glyph}</span></span>;
}
