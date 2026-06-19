export type InventoryItem = { t?: string; id?: string; n?: string } | null | undefined;

export type InventoryResourceRow = {
  id: string;
  name: string;
  glyph: string;
  amount: number;
};

export type InventoryPackSlot = {
  index: number;
  empty: boolean;
  kind: string;
  glyph: string;
  label: string;
  title: string;
  click?: string;
};

function amountOf(inv: any, key: string) {
  const n = Number(inv?.[key] || 0);
  return Number.isFinite(n) ? n : 0;
}

export function inventoryResourceRows(inv: any, resourceKeys: readonly string[], names: Record<string, string>, glyphs: Record<string, string>): InventoryResourceRow[] {
  return resourceKeys.map((id) => ({
    id,
    name: names?.[id] || id,
    glyph: glyphs?.[id] || id,
    amount: amountOf(inv, id),
  }));
}

export function inventoryPackSlots(pack: InventoryItem[], packSize: number, defs: { destroyById?: any; useItems?: any; gearById?: any } = {}): InventoryPackSlot[] {
  const safePack = Array.isArray(pack) ? pack : [];
  const size = Math.max(0, Number(packSize || safePack.length) || 0);
  return Array.from({ length: size }, (_, index) => {
    const item = safePack[index];
    if (!item) return { index, empty: true, kind: "empty", glyph: "·", label: "Empty", title: "Empty slot" };

    if (item.t === "bomb") {
      const b = defs.destroyById?.[item.id || ""];
      return {
        index,
        empty: false,
        kind: "bomb",
        glyph: b?.glyph || "✹",
        label: b?.name || item.id || "Destroy tool",
        title: b?.blurb || "Destroy tool",
      };
    }

    if (item.t === "use") {
      const u = defs.useItems?.[item.id || ""];
      return {
        index,
        empty: false,
        kind: "use",
        glyph: u?.glyph || "✦",
        label: u?.name || item.id || "Use item",
        title: u?.blurb || "Use item",
      };
    }

    if (item.t === "relic") {
      return {
        index,
        empty: false,
        kind: "relic",
        glyph: "🏺",
        label: item.n || "Relic",
        title: item.n || "Relic",
      };
    }

    const g = defs.gearById?.[item.id || ""];
    return {
      index,
      empty: false,
      kind: "gear",
      glyph: g?.glyph || "◇",
      label: g?.name || item.id || "Gear",
      title: "Tap to equip",
      click: "pack-equip",
    };
  });
}
