export type ChromeDensity = "desktop" | "compact" | "pocket";

export type ViewportSnapshot = {
  width?: number | null;
  height?: number | null;
};

export type ActionSlotState = {
  primary?: boolean;
  on?: boolean;
  danger?: boolean;
  disabled?: boolean;
  density?: ChromeDensity;
};

export type ActionStackState = {
  hasRibbon?: boolean;
  density?: ChromeDensity;
};

export function chromeDensityForViewport(v: ViewportSnapshot): ChromeDensity {
  const width = Number(v.width || 0);
  const height = Number(v.height || 0);
  if (width > 0 && (width <= 430 || height <= 540)) return "pocket";
  if (width > 0 && (width <= 900 || height <= 720)) return "compact";
  return "desktop";
}

function pushFlag(out: string[], name: string, enabled: boolean | undefined) {
  if (enabled) out.push(name);
}

/**
 * Single class contract for the primary action bar. The legacy class names stay
 * first so older CSS and delegated click behavior continue to work.
 */
export function actionSlotClass(s: ActionSlotState = {}): string {
  const out = ["action-slot", "ui2-action-slot"];
  pushFlag(out, "primary", s.primary);
  pushFlag(out, "on", s.on);
  pushFlag(out, "danger", s.danger);
  pushFlag(out, "is-disabled", s.disabled);
  if (s.density) out.push(`is-${s.density}`);
  return out.join(" ");
}

export function actionStackClass(s: ActionStackState = {}): string {
  const out = ["action-stack", "ui2-action-stack"];
  pushFlag(out, "has-ribbon", s.hasRibbon);
  if (s.density) out.push(`is-${s.density}`);
  return out.join(" ");
}
