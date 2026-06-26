import test from "node:test";
import assert from "node:assert/strict";

function primaryPick({ player, npc, trade, doodad, building }: Record<string, any>) {
  if (player) return "player";
  if (npc) return "npc";
  if (trade) return "trade";
  if (doodad) return "doodad";
  if (building) return "building";
  return "terrain";
}

test("foreground canvas targets beat broad building plinths", () => {
  assert.equal(primaryPick({ building: {}, doodad: {} }), "doodad");
  assert.equal(primaryPick({ building: {}, trade: {} }), "trade");
  assert.equal(primaryPick({ building: {}, npc: {} }), "npc");
  assert.equal(primaryPick({ building: {}, player: {} }), "player");
});

test("building still wins over terrain when it is the only target", () => {
  assert.equal(primaryPick({ building: {} }), "building");
  assert.equal(primaryPick({}), "terrain");
});
