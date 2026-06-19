import test from "node:test";
import assert from "node:assert/strict";
import { actionSlotClass, actionStackClass, chromeDensityForViewport } from "./hudChromeModel.ts";

test("chromeDensityForViewport separates desktop, compact, and pocket layouts", () => {
  assert.equal(chromeDensityForViewport({ width: 1280, height: 900 }), "desktop");
  assert.equal(chromeDensityForViewport({ width: 820, height: 900 }), "compact");
  assert.equal(chromeDensityForViewport({ width: 390, height: 844 }), "pocket");
  assert.equal(chromeDensityForViewport({ width: 1024, height: 500 }), "pocket");
});

test("actionSlotClass preserves legacy classes while adding chrome contract", () => {
  assert.equal(actionSlotClass(), "action-slot ui2-action-slot");
  assert.equal(
    actionSlotClass({ primary: true, on: true, danger: true, disabled: true, density: "compact" }),
    "action-slot ui2-action-slot primary on danger is-disabled is-compact",
  );
});

test("actionStackClass exposes whether the secondary ribbon is mounted", () => {
  assert.equal(actionStackClass(), "action-stack ui2-action-stack");
  assert.equal(actionStackClass({ hasRibbon: true, density: "pocket" }), "action-stack ui2-action-stack has-ribbon is-pocket");
});
