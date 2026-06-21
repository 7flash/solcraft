import { t } from "../i18n";

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
    title: t("moreMenu.groups.progress.title", "Progress"),
    text: t("moreMenu.groups.progress.text", "Identity, guide cards, skills, and economy status."),
    items: [
      { id: "character", glyph: "🙂", label: t("moreMenu.items.character.label", "Character"), text: t("moreMenu.items.character.text", "Body, colors, and settler profile."), click: "toggle-panel", panel: "char" },
      { id: "guide", glyph: "📜", label: t("moreMenu.items.guide.label", "Guide"), text: t("moreMenu.items.guide.text", "Action/building cards and rewards."), click: "toggle-panel", panel: "quests" },
      { id: "achievements", glyph: "★", label: t("moreMenu.items.achievements.label", "Achievements"), text: t("moreMenu.items.achievements.text", "Skill tiers and progress."), click: "toggle-panel", panel: "skills" },
      { id: "bank", glyph: "🏦", label: t("moreMenu.items.bank.label", "Bank"), text: t("moreMenu.items.bank.text", "Exchange and wallet features."), click: "open-bank" },
    ],
  },
  {
    id: "advanced",
    title: t("moreMenu.groups.advanced.title", "Advanced tools"),
    text: t("moreMenu.groups.advanced.text", "Useful, but not part of the moment-to-moment movement loop."),
    items: [
      { id: "craft", glyph: "🔧", label: t("moreMenu.items.craft.label", "Craft"), text: t("moreMenu.items.craft.text", "Gear, supplies, and deployables."), click: "select-craft" },
      { id: "siege", glyph: "💣", label: t("moreMenu.items.siege.label", "Siege"), text: t("moreMenu.items.siege.text", "Crafted tools that target territory."), click: "select-spawn-tool" },
      { id: "wonder", glyph: "★", label: t("moreMenu.items.wonder.label", "Wonder"), text: t("moreMenu.items.wonder.text", "AI World Wonder planning."), click: "select-wonder" },
      { id: "map", glyph: "🗺", label: t("moreMenu.items.map.label", "World Map"), text: t("moreMenu.items.map.text", "Overview and admin jump tools."), click: "open-world-map" },
    ],
  },
  {
    id: "system",
    title: t("moreMenu.groups.system.title", "System"),
    text: t("moreMenu.groups.system.text", "Visuals, sound, help, and session controls."),
    items: [
      { id: "settings", glyph: "⚙", label: t("moreMenu.items.settings.label", "Settings"), text: t("moreMenu.items.settings.text", "Camera, UI scale, sound, and tutorial reset."), click: "toggle-panel", panel: "settings" },
      { id: "help", glyph: "?", label: t("moreMenu.items.help.label", "Help"), text: t("moreMenu.items.help.text", "Controls and core gameplay explanation."), click: "open-help" },
      { id: "sound", glyph: "♪", label: t("moreMenu.items.sound.label", "Sound"), text: t("moreMenu.items.sound.text", "Toggle music and UI sound."), click: "toggle-ui-sound" },
      { id: "logout", glyph: "↩", label: t("moreMenu.items.logout.label", "Logout"), text: t("moreMenu.items.logout.text", "Leave this local session."), click: "forget-session" },
    ],
  },
];