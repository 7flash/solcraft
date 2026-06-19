export function miniPreviewKey(kind: any, buildingKind: any = "", accent: any = ""): string {
  return `${String(kind || "tile")}|${String(buildingKind || "")}|${String(accent || "")}`;
}

export function miniPreviewLabel(kind: any, buildingKind: any = ""): string {
  const k = String(kind || "tile");
  const b = String(buildingKind || "");
  if (k === "building") return b ? `3D preview: ${b}` : "3D building preview";
  if (k === "tree") return "3D tree preview";
  if (k === "rock") return "3D rock preview";
  if (k === "food") return "3D crop preview";
  if (k === "trade") return "3D exchange preview";
  if (k === "npc") return "3D visitor preview";
  if (k === "foundation") return "3D foundation preview";
  return "3D tile preview";
}
