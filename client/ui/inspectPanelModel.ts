export type InspectPanelBuildingLike = {
  uid?: string;
  kind?: string;
  owner?: number | string;
  ownerName?: string;
  ownerFace?: string | null;
  level?: number;
  hp?: number;
  maxHp?: number;
  cdUntil?: number;
  cl?: string | null;
  nm?: string | null;
};

export type InspectPanelPlayerLike = {
  id?: number | string;
};

export type InspectPanelDraftLike = {
  uid?: string;
  cl?: string | null;
  nm?: string | null;
  at?: number;
};

export type InspectPanelDefLike = {
  baseC?: number;
  name?: string;
  glyph?: string;
  blurb?: string;
};

export function hexFromNumber(value: number | undefined | null, fallback = "#999999"): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `#${Math.max(0, Math.min(0xffffff, Math.trunc(n))).toString(16).padStart(6, "0")}`;
}

export function safeHex(value: unknown, fallback = "#999999"): string {
  const s = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

export function hexToRgb(value: unknown) {
  const v = safeHex(value).slice(1);
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

export function rgba(value: unknown, alpha = 1): string {
  const rgb = hexToRgb(value);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export function draftHasColor(draft: InspectPanelDraftLike | null | undefined, inspectUid: string | null | undefined): boolean {
  return !!draft && String(draft.uid || "") === String(inspectUid || "") && Object.prototype.hasOwnProperty.call(draft, "cl");
}

export function liveBuildingColor(building: InspectPanelBuildingLike, draft: InspectPanelDraftLike | null | undefined, inspectUid: string | null | undefined) {
  return draftHasColor(draft, inspectUid) ? draft?.cl : building?.cl;
}

export function buildingAccent(building: InspectPanelBuildingLike, def: InspectPanelDefLike | null | undefined): string {
  return safeHex(building?.cl || hexFromNumber(def?.baseC, "#999999"));
}

export function inspectAccent(building: InspectPanelBuildingLike, def: InspectPanelDefLike | null | undefined, draft: InspectPanelDraftLike | null | undefined, inspectUid: string | null | undefined): string {
  const live = liveBuildingColor(building, draft, inspectUid);
  return safeHex(live || hexFromNumber(def?.baseC, "#999999"));
}

export function hpRatio(hp: unknown, maxHp: unknown): number {
  const max = Number(maxHp || 0);
  if (!Number.isFinite(max) || max <= 0) return 1;
  const current = Number(hp || 0);
  if (!Number.isFinite(current)) return 0;
  return Math.max(0, Math.min(1, current / max));
}

export function cooldownSecondsLeft(cdUntil: unknown, now = Date.now()): number {
  const end = Number(cdUntil || 0);
  if (!Number.isFinite(end) || end <= 0) return 0;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

export function isMine(building: InspectPanelBuildingLike, player: InspectPanelPlayerLike | null | undefined): boolean {
  return String(building?.owner ?? "") === String(player?.id ?? "");
}

export function inspectPanelViewModel(args: {
  building: InspectPanelBuildingLike;
  player: InspectPanelPlayerLike;
  def?: InspectPanelDefLike | null;
  inspectUid?: string | null;
  inspectDraft?: InspectPanelDraftLike | null;
  faceImage?: string | null;
  now?: number;
}) {
  const { building, player, def, inspectUid, inspectDraft, faceImage, now = Date.now() } = args;
  const mine = isMine(building, player);
  const face = mine ? (faceImage || null) : (building.ownerFace || null);
  const hasDraftColor = draftHasColor(inspectDraft, inspectUid);
  const liveCl = liveBuildingColor(building, inspectDraft, inspectUid);
  const accent = inspectAccent(building, def, inspectDraft, inspectUid);
  const defaultAccent = hexFromNumber(def?.baseC, "#999999");
  return {
    mine,
    face,
    hasDraftColor,
    liveCl,
    accent,
    defaultAccent,
    accentLabel: liveCl ? safeHex(liveCl) : "default",
    accentSoft: rgba(accent, 0.16),
    accentLine: rgba(accent, 0.54),
    cdLeft: cooldownSecondsLeft(building.cdUntil, now),
    hpPct: hpRatio(building.hp, building.maxHp),
    level: Number(building.level || 1) || 1,
  };
}
