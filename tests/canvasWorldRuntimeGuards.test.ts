import test from "node:test";
import assert from "node:assert/strict";
import { guardCanvasWorld, canvasGuardErrorCount } from "../client/world/canvasWorldRuntimeGuards";

test("canvas guard turns pick failure into terrain fallback", () => {
  const world = guardCanvasWorld({ pickFromEvent() { throw new Error("boom"); } } as any, null);
  const pick = world.pickFromEvent({} as any);
  assert.equal(pick.primary, "terrain");
  assert.equal(canvasGuardErrorCount(world, "pickFromEvent"), 1);
});

test("canvas guard leaves successful methods untouched", () => {
  const world = guardCanvasWorld({ canIssueMove() { return true; } } as any, null);
  assert.equal(world.canIssueMove(), true);
  assert.equal(canvasGuardErrorCount(world), 0);
});
