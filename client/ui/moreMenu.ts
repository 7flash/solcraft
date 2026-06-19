export type MoreMenuItem = {
  id: string;
  glyph: string;
  label: string;
  text: string;
  click: string;
  panel?: string;
};

export type MoreMenuGroup = {
  id: string;
  title: string;
  text: string;
  items: MoreMenuItem[];
};

/**
 * Secondary UI contract. The bottom bar stays gameplay-first; everything else
 * lives here until it earns a permanent slot.
 */
export const MORE_MENU_GROUPS: MoreMenuGroup[] = [
  {
    id: "progress",
    title: "Progress",
    text: "Identity, guide cards, skills, and economy status.",
    items: [
      { id: "character", glyph: "🙂", label: "Character", text: "Body, colors, and settler profile.", click: "toggle-panel", panel: "char" },
      { id: "guide", glyph: "📜", label: "Guide", text: "Action/building cards and rewards.", click: "toggle-panel", panel: "quests" },
      { id: "achievements", glyph: "★", label: "Achievements", text: "Skill tiers and progress.", click: "toggle-panel", panel: "skills" },
      { id: "bank", glyph: "🏦", label: "Bank", text: "Exchange and wallet features.", click: "open-bank" },
    ],
  },
  {
    id: "advanced",
    title: "Advanced tools",
    text: "Useful, but not part of the moment-to-moment movement loop.",
    items: [
      { id: "craft", glyph: "🔧", label: "Craft", text: "Gear, supplies, and deployables.", click: "select-craft" },
      { id: "siege", glyph: "💣", label: "Siege", text: "Crafted tools that target territory.", click: "select-spawn-tool" },
      { id: "wonder", glyph: "★", label: "Wonder", text: "AI World Wonder planning.", click: "select-wonder" },
      { id: "map", glyph: "🗺", label: "World Map", text: "Overview and admin jump tools.", click: "open-world-map" },
    ],
  },
  {
    id: "system",
    title: "System",
    text: "Visuals, sound, help, and session controls.",
    items: [
      { id: "settings", glyph: "⚙", label: "Settings", text: "Camera, UI scale, sound, and tutorial reset.", click: "toggle-panel", panel: "settings" },
      { id: "help", glyph: "?", label: "Help", text: "Controls and core gameplay explanation.", click: "open-help" },
      { id: "sound", glyph: "♪", label: "Sound", text: "Toggle music and UI sound.", click: "toggle-ui-sound" },
      { id: "logout", glyph: "↩", label: "Logout", text: "Leave this local session.", click: "forget-session" },
    ],
  },
];
