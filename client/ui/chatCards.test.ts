import test from "node:test";
import assert from "node:assert/strict";
import { chatCardSubtitle, chatCardTitle, formatBuildingChatCard, formatLocationChatCard, parseChatCard } from "./chatCards.ts";

test("formats and parses location cards", () => {
  const msg = formatLocationChatCard({ x: -12, z: 8, label: "Meet here" });
  assert.equal(msg, "[[sc:location|x=-12|z=8|label=Meet%20here]]");
  const card = parseChatCard(msg);
  assert.deepEqual(card, { kind: "location", x: -12, z: 8, label: "Meet here" });
  assert.equal(chatCardTitle(card), "Meet here");
  assert.equal(chatCardSubtitle(card), "Location · -12,8");
});

test("formats keep cards as raid targets", () => {
  const msg = formatBuildingChatCard({ uid: 77, x: 20, z: -9, kind: "keep", label: "North Keep" });
  const card = parseChatCard(msg);
  assert.deepEqual(card, { kind: "keep", uid: 77, x: 20, z: -9, label: "North Keep" });
  assert.equal(chatCardSubtitle(card), "Raid target · 20,-9");
});

test("ignores normal chat", () => {
  assert.equal(parseChatCard("hello frontier"), null);
});
