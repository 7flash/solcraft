import test from "node:test";
import assert from "node:assert/strict";
import { MORE_MENU_GROUPS } from "./moreMenu.ts";

test("more menu keeps secondary systems outside the core action bar", () => {
  const ids = MORE_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.id));
  assert.equal(ids.includes("bank"), true);
  assert.equal(ids.includes("siege"), true);
  assert.equal(ids.includes("wonder"), true);
  assert.equal(ids.includes("settings"), true);
});

test("more menu items all declare click actions", () => {
  for (const group of MORE_MENU_GROUPS) {
    assert.ok(group.title.length > 0);
    assert.ok(group.items.length > 0);
    for (const item of group.items) {
      assert.ok(item.click.length > 0, `${item.id} needs a click action`);
    }
  }
});
