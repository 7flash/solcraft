export const FOUNDATION_KIND = "foundation";

export const FOUNDATION_BUILD_KINDS = [
  "cottage",
  "lumber",
  "quarry",
  "farm",
  "warehouse",
] as const;

export type FoundationBuildKind = (typeof FOUNDATION_BUILD_KINDS)[number];

export function isFoundationBuildKind(value: any): value is FoundationBuildKind {
  return FOUNDATION_BUILD_KINDS.includes(String(value || "") as FoundationBuildKind);
}

export function foundationChoiceLabel(kind: any) {
  const k = String(kind || "");
  if (k === "cottage") return "House";
  if (k === "lumber") return "Lumber Camp";
  if (k === "quarry") return "Quarry";
  if (k === "farm") return "Farm";
  if (k === "warehouse") return "Warehouse";
  return "Building";
}
