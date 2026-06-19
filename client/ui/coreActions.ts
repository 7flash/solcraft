export type CoreAction = {
  key: number;
  icon: string;
  label: string;
  click: string;
  help: string;
};

/**
 * Primary HUD contract. Keep this tiny: it is the gameplay loop, not the whole
 * feature list. Advanced systems stay in panels/modals until they earn a slot.
 */
export const CORE_ACTIONS: CoreAction[] = [
  { key: 1, icon: "➤", label: "Move", click: "explore-mode", help: "Clear tools. Click, WASD, arrows, or diagonal key combos to walk." },
  { key: 2, icon: "🪓", label: "Chop", click: "gather-wood", help: "Highlight trees. Chopped wood drops as pickups." },
  { key: 3, icon: "⛏", label: "Mine", click: "gather-stone", help: "Highlight rocks. Mined stone drops as pickups." },
  { key: 4, icon: "⚑", label: "Claim", click: "claim", help: "Capture connected frontier tiles." },
  { key: 5, icon: "⌂", label: "Build", click: "select-build", help: "Open the building ribbon and place structures." },
  { key: 6, icon: "✦", label: "Use", click: "use-tool", help: "Interact with nearby buildings, offers, scrolls, and supplies." },
  { key: 7, icon: "☰", label: "More", click: "open-more", help: "Settings, map, guide, bank, and advanced panels live outside the core bar." },
];
