import test from "node:test";
import assert from "node:assert/strict";
import { chatCardCta, chatCardSubtitle, chatCardTitle, formatBuildingChatCard, formatKeepRallyChatCard, formatLocationChatCard, parseChatCard } from "./chatCards.ts";

test("formats and parses location cards", () => {
  const msg = formatLocationChatCard({ x: -12, z: 8, label: "Meet here" });
  assert.equal(msg, "[[sc:location|x=-12|z=8|label=Meet%20here]]");
  const card = parseChatCard(msg);
  assert.deepEqual(card, { kind: "location", x: -12, z: 8, label: "Meet here" });
  assert.equal(chatCardTitle(card), "Meet here");
  assert.equal(chatCardSubtitle(card), "Location · -12,8");
  assert.equal(chatCardCta(card), "Open map point");
});

test("formats keep cards as raid targets", () => {
  const msg = formatBuildingChatCard({ uid: 77, x: 20, z: -9, kind: "keep", label: "North Keep" });
  const card = parseChatCard(msg);
  assert.deepEqual(card, { kind: "keep", uid: 77, x: 20, z: -9, label: "North Keep" });
  assert.equal(chatCardSubtitle(card), "Raid target · 20,-9");
});

test("formats keep rally cards with health and coins", () => {
  const msg = formatKeepRallyChatCard({ uid: 9, x: 4, z: -3, label: "Broken Keep", hp: 72.8, maxHp: 140, coins: 31 });
  const card = parseChatCard(msg);
  assert.deepEqual(card, { kind: "keep", uid: 9, x: 4, z: -3, label: "Broken Keep", hp: 72, maxHp: 140, coins: 31 });
  assert.equal(chatCardTitle(card), "Broken Keep");
  assert.equal(chatCardSubtitle(card), "Raid target · 4,-3 · 72/140 HP · 31 coins");
  assert.equal(chatCardCta(card), "Open rally");
});

test("cleans unsafe card labels", () => {
  const card = parseChatCard("[[sc:location|x=1|z=2|label=Bad%5D%5D%0Aname]]");
  assert.deepEqual(card, { kind: "location", x: 1, z: 2, label: "Bad name" });
});

test("ignores normal chat", () => {
  assert.equal(parseChatCard("hello frontier"), null);
});
