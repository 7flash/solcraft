export type PlayerBillboardTool = "none" | "axe" | "pickaxe" | "hammer" | "shovel" | "capture" | "sword" | "staff" | "spear";

export function normalizeBillboardTool(value: any): PlayerBillboardTool {
  const v = String(value || "none").toLowerCase();
  if (v === "wood" || v === "axe") return "axe";
  if (v === "stone" || v === "pick" || v === "pickaxe") return "pickaxe";
  if (v === "build" || v === "hammer") return "hammer";
  if (v === "demolish" || v === "shovel") return "shovel";
  if (v === "claim" || v === "capture" || v === "flag") return "capture";
  if (v === "sword" || v === "attack" || v === "siege") return "sword";
  if (v === "staff" || v === "use") return "staff";
  if (v === "spear") return "spear";
  return "none";
}

export function billboardColor(value: any, fallback = "#14f195") {
  if (typeof value === "number" && Number.isFinite(value)) return `#${Math.max(0, Math.min(0xffffff, Math.trunc(value))).toString(16).padStart(6, "0")}`;
  const s = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

export function playerBillboardSignature(opts: any = {}) {
  return JSON.stringify({
    body: billboardColor(opts.body, "#14f195"),
    skin: billboardColor(opts.skin || opts.palette?.skin, "#f0c08a"),
    hair: billboardColor(opts.hair || opts.palette?.hair, "#33251d"),
    cloth: billboardColor(opts.cloth || opts.palette?.primaryCloth || opts.palette?.primary || opts.body, "#14f195"),
    trim: billboardColor(opts.trim || opts.palette?.secondaryCloth || opts.hat, "#ffd76e"),
    tool: normalizeBillboardTool(opts.heldTool || opts.tool),
  });
}
