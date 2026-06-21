import test from "node:test";
import assert from "node:assert/strict";
import { billboardColor, normalizeBillboardTool, playerBillboardSignature } from "./playerBillboardModel.ts";

test("normalizes tool names for billboard sprites", () => {
  assert.equal(normalizeBillboardTool("wood"), "axe");
  assert.equal(normalizeBillboardTool("stone"), "pickaxe");
  assert.equal(normalizeBillboardTool("build"), "hammer");
  assert.equal(normalizeBillboardTool("claim"), "capture");
  assert.equal(normalizeBillboardTool("unknown"), "none");
});

test("normalizes numeric and hex colors", () => {
  assert.equal(billboardColor(0x14f195), "#14f195");
  assert.equal(billboardColor("#FFD76E"), "#ffd76e");
  assert.equal(billboardColor("bad", "#111111"), "#111111");
});

test("billboard signatures are stable", () => {
  const a = playerBillboardSignature({ body: 0x14f195, hat: 0xffd76e, heldTool: "wood", palette: { skin: "#f0c08a", hair: "#333333" } });
  const b = playerBillboardSignature({ body: 0x14f195, hat: 0xffd76e, heldTool: "axe", palette: { skin: "#f0c08a", hair: "#333333" } });
  assert.equal(a, b);
  assert.notEqual(a, playerBillboardSignature({ body: 0x14f195, hat: 0xffd76e, heldTool: "hammer" }));
});

test("normalizes sword tool for billboard sprites", () => {
  assert.equal(normalizeBillboardTool("sword"), "sword");
  assert.equal(normalizeBillboardTool("siege"), "sword");
});
