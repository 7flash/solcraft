import test from "node:test";
import assert from "node:assert/strict";
import { CORE_ACTIONS } from "./coreActions.ts";

test("bottom toolbelt includes sword as sixth tool", () => {
  assert.deepEqual(CORE_ACTIONS.map((a) => a.label), ["Axe", "Pickaxe", "Hammer", "Shovel", "Capture", "Sword"]);
});
