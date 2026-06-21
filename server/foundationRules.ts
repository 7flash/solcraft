export const FOUNDATION_KIND = "foundation";

export const FOUNDATION_BUILD_KINDS = [
  "cottage",
  "lumber",
  "quarry",
  "farm",
  "market",
] as const;

export type FoundationBuildKind = (typeof FOUNDATION_BUILD_KINDS)[number];

export function isFoundationBuildKind(value: any): value is FoundationBuildKind {
  return FOUNDATION_BUILD_KINDS.includes(String(value || "") as FoundationBuildKind);
}

export function foundationChoiceLabel(kind: any) {
  const k = String(kind || "");
  if (k === "cottage") return "House";
  if (k === "lumber") return "Lumber Camp";
  if (k === "quarry") return "Mine";
  if (k === "farm") return "Farm";
  if (k === "market") return "Market";
  return "Building";
}
