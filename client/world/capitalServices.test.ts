import test from "node:test";
import assert from "node:assert/strict";
import { capitalBuildingByService, capitalServiceAvailable, capitalServiceForBuilding, capitalServiceInfo } from "./capitalServices.ts";

test("capital services map virtual buildings to world services", () => {
  const bank = capitalBuildingByService("bank");
  assert.equal(bank?.nm, "Capital Bank");
  assert.equal(capitalServiceForBuilding(bank)?.action, "bank");
});

test("unknown service falls back to town hall copy", () => {
  const info = capitalServiceInfo("missing");
  assert.equal(info.id, "townhall");
  assert.match(info.summary, /shared world/i);
});

test("near-gated services require standing beside the capital building", () => {
  assert.equal(capitalServiceAvailable(1, capitalServiceInfo("bank")), true);
  assert.equal(capitalServiceAvailable(3, capitalServiceInfo("bank")), false);
  assert.equal(capitalServiceAvailable(9, capitalServiceInfo("gate")), true);
});
