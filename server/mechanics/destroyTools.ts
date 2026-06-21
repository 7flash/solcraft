import { BOMB_FUSE_MS, BOMB_ITEM_COST, DESTROY_BY_ID, DESTROY_TOOLS, XP, type PackItem } from "../shared";

type PlayerLike = { id: number; name?: string; inv?: Record<string, number>; pack?: PackItem[]; skills?: any };

type Result = { ok: boolean; msg?: string; reasonCode?: string; [key: string]: any };

export type DestroyToolsContext = {
  gameTuning(): any;
  packFull(p: PlayerLike): boolean;
  afford(p: PlayerLike, cost: Partial<Record<string, number>>): string[];
  spend(p: PlayerLike, cost: Partial<Record<string, number>>): void;
  packAdd(p: PlayerLike, item: PackItem): boolean;
  addXp(p: PlayerLike, amount: number): void;
  autoTrainSkill(p: PlayerLike, id: string, amount?: number): void;
  bombCount(p: PlayerLike, id: string): number;
  ok(extra?: Record<string, any>): Result;
  err(msg: string, reasonCode?: string): Result;
};

export function tunedDestroySpecFor(ctx: Pick<DestroyToolsContext, "gameTuning">, variant: string) {
  const base: any = DESTROY_BY_ID[String(variant || "popper")] || DESTROY_TOOLS[0];
  const tune = ctx.gameTuning();
  const scaleCost = (cost: any = {}) => Object.fromEntries(
    Object.entries(cost).map(([k, v]) => [k, Math.max(0, Math.ceil(Number(v || 0) * Number(tune.bombCostMultiplier || 1)))])
  );
  return {
    ...base,
    cost: scaleCost(base.cost || BOMB_ITEM_COST),
    fuseMs: Math.max(1000, Math.round(Number(base.fuseMs || BOMB_FUSE_MS) * Number(tune.bombFuseMultiplier || 1))),
    radius: Math.max(0, Math.round(Number(base.radius || 0) + Number(tune.bombRadiusBonus || 0))),
  };
}

export function craftDestroyToolFor(ctx: DestroyToolsContext, p: PlayerLike, variant = "popper") {
  const spec = tunedDestroySpecFor(ctx, String(variant || "popper"));
  if (ctx.packFull(p)) return ctx.err("Backpack full — make room before crafting another tool.");
  const miss = ctx.afford(p, spec.cost as any);
  if (miss.length) return ctx.err(`${spec.name} needs science: ` + miss.join(" "));
  ctx.spend(p, spec.cost as any);
  ctx.packAdd(p, { t: "bomb", id: spec.id } as PackItem);
  ctx.addXp(p, XP.craft);
  ctx.autoTrainSkill(p, "warrior", spec.id === "breacher" || spec.id === "cutter" ? 6 : 4);
  return ctx.ok({
    note: `Crafted ${spec.glyph} ${spec.name}. Bombs are needed to breach Keeps and obtain coins. Use Deploy (6) to place it.`,
    count: ctx.bombCount(p, spec.id),
    science: p.inv?.sc || 0,
  });
}

export function destroyToolListFor(ctx: Pick<DestroyToolsContext, "gameTuning">) {
  return DESTROY_TOOLS.map((tool) => tunedDestroySpecFor(ctx, tool.id));
}
