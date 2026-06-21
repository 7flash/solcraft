import { RESOURCE_BASE_CAP, SCIENCE_BASE_CAP, SCIENCE_CAP_PER_ACADEMY, type ResKey } from "../shared";

type PlayerLike = { id: number; inv?: Record<string, number> };
type BuildingLike = { kind?: string; level?: number };
type BuildingDefLike = { storageBonus?: number; foodStorageBonus?: number } | undefined;

export type ScienceContext = {
  nonBombBuildings(playerId: number): BuildingLike[];
  buildingDef(kind: string): BuildingDefLike;
};

export function academyScienceCapFor(ctx: ScienceContext, p: PlayerLike): number {
  let cap = SCIENCE_BASE_CAP;
  for (const b of ctx.nonBombBuildings(Number(p.id || 0))) {
    if (b.kind !== "academy") continue;
    cap += SCIENCE_CAP_PER_ACADEMY * Math.max(1, Math.floor(Number(b.level || 1)));
  }
  return cap;
}

export function resourceCapFor(ctx: ScienceContext, p: PlayerLike, res: string): number {
  if (res === "g" || res === "e") return Number.POSITIVE_INFINITY;
  if (res === "sc") return academyScienceCapFor(ctx, p);
  let cap = RESOURCE_BASE_CAP;
  for (const b of ctx.nonBombBuildings(Number(p.id || 0))) {
    const def = ctx.buildingDef(String(b.kind || ""));
    cap += Number(def?.storageBonus || 0);
    if (res === "f") cap += Number(def?.foodStorageBonus || 0);
  }
  return cap;
}

export function storageCapsFor(ctx: ScienceContext, p: PlayerLike) {
  return {
    w: resourceCapFor(ctx, p, "w"),
    p: resourceCapFor(ctx, p, "p"),
    s: resourceCapFor(ctx, p, "s"),
    f: resourceCapFor(ctx, p, "f"),
    sh: resourceCapFor(ctx, p, "sh"),
    sc: resourceCapFor(ctx, p, "sc"),
  } as Record<Exclude<ResKey, "g">, number> & { sc: number };
}

export function scienceStatusFor(ctx: ScienceContext, p: PlayerLike) {
  const science = Math.max(0, Math.floor(Number(p.inv?.sc || 0)));
  const cap = academyScienceCapFor(ctx, p);
  const academies = ctx.nonBombBuildings(Number(p.id || 0)).filter((b) => b.kind === "academy");
  const academyLevels = academies.reduce((sum, b) => sum + Math.max(1, Math.floor(Number(b.level || 1))), 0);
  return { science, cap, academies: academies.length, academyLevels };
}
