
import { TOOL_ATLAS_ROWS } from "../../game/atlasCatalog";

export type AdminNavStatus = "active" | "lab" | "debug" | "legacy";
export type AdminNavItem = {
  title: string;
  href: string;
  description: string;
  status?: AdminNavStatus;
  badge?: string;
};
export type AdminNavSection = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  items: AdminNavItem[];
};

export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    id: "production",
    eyebrow: "Deploy safely",
    title: "Production workflow",
    description: "Only the pages needed to import production state, impersonate players locally, publish atlases, and force client refreshes.",
    items: [
      { title: "World Sync + Player View", href: "/admin/world-sync", badge: "local import", description: "Pull production world into local SQLite and open the game as any player from the imported state." },
      { title: "Atlas Studio", href: "/admin/atlas", badge: "runtime art", description: "Upload, compose, crop, publish, and audit runtime atlases including the new tool atlas." },
      { title: "Client Refresh", href: "/admin/refresh", badge: "deploy", description: "Force active clients to refresh after a production deploy or runtime-art update." },
      { title: "Debug · Atlas", href: "/admin/debug/atlas", status: "debug", description: "Read-only runtime atlas status, versions, bounds, pads, modes, and cache-bust data." },
    ],
  },
  {
    id: "gameplay",
    eyebrow: "Tune and verify",
    title: "Gameplay operations",
    description: "Keep the admin surface small: player resources, economy knobs, audio, and the current AI/wonder labs.",
    items: [
      { title: "Player Resources", href: "/admin/player-resources", description: "Grant/set resources for a selected player during local QA." },
      { title: "Economy Studio", href: "/admin/economy", description: "Tune energy, caps, costs, building roles, and server economy controls." },
      { title: "Audio Studio", href: "/admin/audio", status: "lab", description: "Upload background music and tune runtime sound settings." },
      { title: "World Wonders Studio", href: "/admin/wonders", status: "lab", description: "Generate and inspect real AI World Wonder recipes." },
    ],
  },
  {
    id: "labs",
    eyebrow: "Keep out of main path",
    title: "Labs and legacy pages",
    description: "Useful while refactoring, but not part of the production deployment path. These can be removed or hidden later after we replace their workflows.",
    items: [
      { title: "Doll Studio", href: "/admin/doll", status: "legacy", description: "Character preview remains useful, but tool art should move to the dedicated tool atlas." },
      { title: "Terrain Lab", href: "/admin/terrain", status: "lab", description: "Procedural terrain warmth/texture controls." },
      { title: "Mechanics Labs", href: "/admin/mechanics", status: "lab", description: "Focused mechanics test pages for Keeps, bombs, crafting, and future systems." },
      { title: "Bank Studio", href: "/admin/bank", status: "legacy", description: "Keep hidden from the main path until the in-game economy is stable again." },
      { title: "Wonder Template Lab", href: "/admin/wonder-templates", status: "lab", description: "Hand-authored examples for prompt archetypes." },
    ],
  },
];

export const ADMIN_DEBUG_ITEMS: AdminNavItem[] = [
  { title: "Debug · TradJS", href: "/admin/debug/tradjs", status: "debug", description: "Repro tests for tabs, filtered lists, and claim-style buttons." },
  { title: "Debug · Economy", href: "/admin/debug/economy", status: "debug", description: "World counts, circulation, login token gate, controls, and active players." },
  { title: "Debug · Player State", href: "/admin/debug/player-state", status: "debug", description: "Read-only player resource/tile/storage snapshot." },
  { title: "Debug · Audio", href: "/admin/debug/audio", status: "debug", description: "Audio runtime payload and browser playback diagnostics." },
];

export const TOOL_ATLAS_ADMIN_SUMMARY = {
  title: "Tool Atlas",
  href: "/admin/atlas?atlas=tool",
  runtimeFile: "tool_atlas_clean.png",
  cols: 5,
  rows: 4,
  rowsPlan: TOOL_ATLAS_ROWS,
};

export function allAdminItems() {
  return [...ADMIN_SECTIONS.flatMap((section) => section.items), ...ADMIN_DEBUG_ITEMS];
}

export function adminItemByHref(href: string) {
  return allAdminItems().find((item) => item.href === href) || null;
}
