import { CAPITAL_CORE_RADIUS, CAPITAL_SERVICE_RADIUS } from "../../game/capitalRules.ts";

export type CapitalBuilding = {
  uid: number;
  owner: number;
  ownerName: string;
  ownerBody: number;
  kind: string;
  x: number;
  z: number;
  nm: string;
  cl?: string;
  level: number;
  hp: number;
  maxHp: number;
  stored: number;
  capital: true;
  service?: "townhall" | "bank" | "market" | "tailor" | "guide" | "gate";
};

export const CAPITAL_CENTER = { x: 0, z: 0 } as const;
export const CAPITAL_VIEW_RADIUS = CAPITAL_SERVICE_RADIUS;
export const CAPITAL_BUILDINGS: CapitalBuilding[] = [
  { uid: -101, owner: 0, ownerName: "Capital", ownerBody: 0xffd76e, kind: "townhall", x: 0, z: 0, nm: "Capital Town Hall", cl: "#ffd76e", level: 5, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "townhall" },
  { uid: -102, owner: 0, ownerName: "Capital", ownerBody: 0x14f195, kind: "goldmine", x: 2, z: 0, nm: "Capital Bank", cl: "#14f195", level: 5, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "bank" },
  { uid: -103, owner: 0, ownerName: "Capital", ownerBody: 0x9945ff, kind: "market", x: -2, z: 0, nm: "Market Square", cl: "#9945ff", level: 3, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "market" },
  { uid: -104, owner: 0, ownerName: "Capital", ownerBody: 0x7dcfe8, kind: "cottage", x: 0, z: 2, nm: "Mirror Tailor", cl: "#7dcfe8", level: 3, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "tailor" },
  { uid: -105, owner: 0, ownerName: "Capital", ownerBody: 0xfff0a8, kind: "academy", x: 0, z: -2, nm: "Guide Hall", cl: "#fff0a8", level: 3, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "guide" },
  { uid: -106, owner: 0, ownerName: "Capital", ownerBody: 0xd6604f, kind: "watchtower", x: 4, z: 0, nm: "East Gate", cl: "#d6604f", level: 2, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "gate" },
  { uid: -107, owner: 0, ownerName: "Capital", ownerBody: 0xd6604f, kind: "watchtower", x: -4, z: 0, nm: "West Gate", cl: "#d6604f", level: 2, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "gate" },
  { uid: -108, owner: 0, ownerName: "Capital", ownerBody: 0xd6604f, kind: "watchtower", x: 0, z: 4, nm: "South Gate", cl: "#d6604f", level: 2, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "gate" },
  { uid: -109, owner: 0, ownerName: "Capital", ownerBody: 0xd6604f, kind: "watchtower", x: 0, z: -4, nm: "North Gate", cl: "#d6604f", level: 2, hp: 9999, maxHp: 9999, stored: 0, capital: true, service: "gate" },
];

export function isCapitalVirtualBuilding(uid: any) {
  return Number(uid) < 0 && CAPITAL_BUILDINGS.some((b) => b.uid === Number(uid));
}

export function capitalBuildingsInView(ax: number, az: number, radius: number) {
  const r = Math.max(0, Number(radius) || 0);
  return CAPITAL_BUILDINGS.filter((b) => Math.max(Math.abs(b.x - ax), Math.abs(b.z - az)) <= r);
}

export function capitalLabelVisibleForPlayer(building: CapitalBuilding, playerX: number, playerZ: number) {
  if (!building || building.service === "gate") return false;
  return Math.max(Math.abs(building.x - playerX), Math.abs(building.z - playerZ)) <= Math.max(3, CAPITAL_CORE_RADIUS / 2);
}
