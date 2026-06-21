import type { EcsWorld, EntityId, GameRules, SystemContext } from "./types.ts";
import { DEFAULT_ECS_RULES } from "./tuning.ts";
import { err, type Result } from "./result.ts";
import { moveEntity, movePath } from "./systems/movement.ts";
import { harvestAt } from "./systems/harvest.ts";
import { claimTile } from "./systems/claim.ts";
import { placeBuilding, upgradeBuilding, demolishBuilding } from "./systems/building.ts";

export type EcsAction = { type: string; [key: string]: unknown };

export function ecsContext(now = Date.now(), rules: GameRules = DEFAULT_ECS_RULES): SystemContext { return { now, rules }; }

export function dispatchEcs(world: EcsWorld, playerId: EntityId, action: EcsAction, ctx: SystemContext = ecsContext()): Result {
  switch (String(action.type || "")) {
    case "move": return moveEntity(world, playerId, Number(action.x || 0), Number(action.z || 0), ctx);
    case "movePath": return movePath(world, playerId, Array.isArray(action.steps) ? action.steps as any[] : [], ctx);
    case "harvestStart":
    case "harvestFinish":
    case "harvest": return harvestAt(world, playerId, Number(action.x || 0), Number(action.z || 0), ctx);
    case "claim": return claimTile(world, playerId, Number(action.x || 0), Number(action.z || 0), ctx);
    case "place": return placeBuilding(world, playerId, String(action.kind || ""), Number(action.x || 0), Number(action.z || 0), ctx);
    case "upgrade": return upgradeBuilding(world, playerId, Number(action.uid || 0), ctx);
    case "demolish": return demolishBuilding(world, playerId, Number(action.uid || 0), ctx);
    default: return err("Unknown ECS action", "UNKNOWN_ECS_ACTION", { type: action.type });
  }
}
