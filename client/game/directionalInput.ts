import type { Coord } from "../../game/ecs/types.ts";

/**
 * Keyboard movement should be pure and testable. The renderer decides when to
 * call it; this helper only converts held keys into one 8-way movement intent.
 */
export type MoveKey = "up" | "down" | "left" | "right";
export type MoveKeyState = ReadonlySet<string> | Record<string, boolean> | string[];

const KEY_TO_MOVE: Record<string, MoveKey> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

export function normalizeMoveKey(key: unknown): MoveKey | "" {
  return KEY_TO_MOVE[String(key || "").toLowerCase()] || "";
}

export function isMoveKey(key: unknown): boolean {
  return !!normalizeMoveKey(key);
}

function hasKey(keys: MoveKeyState, key: MoveKey): boolean {
  if (Array.isArray(keys)) return keys.includes(key);
  if (keys instanceof Set) return keys.has(key);
  return !!keys[key];
}

export function movementVectorFromKeys(keys: MoveKeyState): Coord {
  const dx = (hasKey(keys, "right") ? 1 : 0) - (hasKey(keys, "left") ? 1 : 0);
  const dz = (hasKey(keys, "down") ? 1 : 0) - (hasKey(keys, "up") ? 1 : 0);
  return { x: Math.max(-1, Math.min(1, dx)), z: Math.max(-1, Math.min(1, dz)) };
}

/**
 * Rotates one keyboard step into world-grid space using the existing fixed
 * isometric camera quadrants. This mirrors app/page.client.tsx tryMoveDelta.
 */
export function rotateKeyboardVector(dx: number, dz: number, cameraYaw = Math.PI / 4): Coord {
  const q = ((Math.round((((cameraYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4;
  const rot = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][q];
  const x = dx * rot[0] + dz * rot[1];
  const z = dx * rot[2] + dz * rot[3];
  const cx = Math.max(-1, Math.min(1, x));
  const cz = Math.max(-1, Math.min(1, z));
  return { x: Object.is(cx, -0) ? 0 : cx, z: Object.is(cz, -0) ? 0 : cz };
}
