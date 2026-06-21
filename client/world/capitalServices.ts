import { CAPITAL_BUILDINGS, type CapitalBuilding } from "./capitalLayout.ts";

export type CapitalServiceId = "townhall" | "bank" | "market" | "tailor" | "guide" | "gate";

export type CapitalServiceInfo = {
  id: CapitalServiceId;
  title: string;
  eyebrow: string;
  glyph: string;
  summary: string;
  actionLabel: string;
  action: "charter" | "bank" | "market" | "tailor" | "guide" | "gate";
  requiresNear: boolean;
};

export const CAPITAL_SERVICE_INFO: Record<CapitalServiceId, CapitalServiceInfo> = {
  townhall: {
    id: "townhall",
    title: "Capital Town Hall",
    eyebrow: "public capital",
    glyph: "🏛",
    summary: "The center of the shared world. Settlements start outside the protected service ring and expand outward from here.",
    actionLabel: "Settlement charter",
    action: "charter",
    requiresNear: true,
  },
  bank: {
    id: "bank",
    title: "Capital Bank",
    eyebrow: "token exchange",
    glyph: "🏦",
    summary: "Deposit and withdraw tokens only from the capital bank. This keeps wallet services grounded in the world instead of permanent HUD menus.",
    actionLabel: "Open bank",
    action: "bank",
    requiresNear: true,
  },
  market: {
    id: "market",
    title: "Market Square",
    eyebrow: "trade hub",
    glyph: "⚖",
    summary: "The public trading plaza for offers and future settlement commerce.",
    actionLabel: "Open market",
    action: "market",
    requiresNear: true,
  },
  tailor: {
    id: "tailor",
    title: "Mirror Tailor",
    eyebrow: "appearance",
    glyph: "🪞",
    summary: "Change character appearance here instead of from an always-on menu.",
    actionLabel: "Change appearance",
    action: "tailor",
    requiresNear: true,
  },
  guide: {
    id: "guide",
    title: "Guide Hall",
    eyebrow: "quests and rewards",
    glyph: "📜",
    summary: "Guides, basic rewards, and future quest NPCs live here in the capital.",
    actionLabel: "Open guide",
    action: "guide",
    requiresNear: true,
  },
  gate: {
    id: "gate",
    title: "Capital Gate",
    eyebrow: "city boundary",
    glyph: "🛡",
    summary: "A protected gate marking the safe service zone before the frontier begins.",
    actionLabel: "Walk to gate",
    action: "gate",
    requiresNear: false,
  },
};

export function capitalServiceInfo(id: any): CapitalServiceInfo {
  const key = String(id || "townhall") as CapitalServiceId;
  return CAPITAL_SERVICE_INFO[key] || CAPITAL_SERVICE_INFO.townhall;
}

export function capitalServiceForBuilding(building: Partial<CapitalBuilding> | null | undefined): CapitalServiceInfo | null {
  if (!building || !building.capital) return null;
  return capitalServiceInfo(building.service || "townhall");
}

export function capitalBuildingByService(service: any): CapitalBuilding | null {
  const id = String(service || "") as CapitalServiceId;
  return CAPITAL_BUILDINGS.find((b) => b.service === id) || null;
}

export function capitalServiceAvailable(distance: number, info: CapitalServiceInfo) {
  if (!info.requiresNear) return true;
  return Number(distance) <= 1;
}
