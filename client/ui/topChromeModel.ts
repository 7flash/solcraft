export type TopChromeButtonId = never;

export type TopChromeState = {
  settingsOpen?: boolean;
  muted?: boolean;
};

export type TopChromeButton = never;

/**
 * Stage 27: no buttons around the minimap. Esc opens the pause/settings menu.
 * Kept as a stable exported selector so older imports/tests do not break.
 */
export function topChromeButtons(_state: TopChromeState = {}): TopChromeButton[] {
  return [];
}
