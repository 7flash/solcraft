export type ChatCardKind = "location" | "building" | "keep";

export type ChatCard = {
  kind: ChatCardKind;
  x: number;
  z: number;
  uid?: number;
  label?: string;
};

function cleanLabel(value: any): string {
  return String(value || "")
    .replace(/[\[\]\n\r|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function enc(value: any): string {
  return encodeURIComponent(cleanLabel(value));
}

function int(value: any, fallback = 0): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

export function formatLocationChatCard(input: { x: number; z: number; label?: string }): string {
  const x = int(input.x);
  const z = int(input.z);
  const label = enc(input.label || `Location ${x},${z}`);
  return `[[sc:location|x=${x}|z=${z}|label=${label}]]`;
}

export function formatBuildingChatCard(input: { uid?: number; x: number; z: number; kind?: string; label?: string }): string {
  const x = int(input.x);
  const z = int(input.z);
  const kind = String(input.kind || "building").toLowerCase() === "keep" ? "keep" : "building";
  const uid = int(input.uid || 0);
  const label = enc(input.label || (kind === "keep" ? "Keep" : `Building ${x},${z}`));
  return `[[sc:${kind}|uid=${uid}|x=${x}|z=${z}|label=${label}]]`;
}

export function parseChatCard(message: string): ChatCard | null {
  const raw = String(message || "");
  const start = raw.indexOf("[[sc:");
  if (start < 0) return null;
  const end = raw.indexOf("]]", start + 5);
  if (end < 0) return null;
  const body = raw.slice(start + 5, end);
  const parts = body.split("|");
  const kindRaw = String(parts.shift() || "").toLowerCase();
  const kind: ChatCardKind = kindRaw === "keep" ? "keep" : kindRaw === "building" ? "building" : "location";
  const fields: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const x = int(fields.x, NaN as any);
  const z = int(fields.z, NaN as any);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const uid = int(fields.uid || 0, 0);
  let label = "";
  try { label = decodeURIComponent(fields.label || ""); } catch { label = fields.label || ""; }
  const out: ChatCard = { kind, x, z };
  if (uid) out.uid = uid;
  const clean = cleanLabel(label);
  if (clean) out.label = clean;
  return out;
}

export function chatCardTitle(card: ChatCard | null | undefined): string {
  if (!card) return "Shared place";
  if (card.label) return card.label;
  if (card.kind === "keep") return "Shared keep";
  if (card.kind === "building") return "Shared building";
  return "Shared location";
}

export function chatCardSubtitle(card: ChatCard | null | undefined): string {
  if (!card) return "";
  const kind = card.kind === "keep" ? "Raid target" : card.kind === "building" ? "Building" : "Location";
  return `${kind} · ${card.x},${card.z}`;
}
