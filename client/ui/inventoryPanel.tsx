// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { COSTI, DESTROY_BY_ID, GEAR_BY_ID, PACK_SIZE, RES_KEYS, RES_NAMES, USE_ITEMS } from "../../game/shared";
import { inventoryPackSlots, inventoryResourceRows } from "./inventoryPanelModel";

export function InventoryPanelView(props: any) {
  const m = props.player;
  if (!m) return <div />;
  const resources = inventoryResourceRows(m.inv || {}, RES_KEYS, RES_NAMES as any, COSTI as any);
  const slots = inventoryPackSlots(m.pack || [], PACK_SIZE, { destroyById: DESTROY_BY_ID, useItems: USE_ITEMS, gearById: GEAR_BY_ID });

  return <>
    <div className="utility-row">
      {resources.map((r) => <span className="stat" aria-label={r.name}>{r.glyph} {r.amount}</span>)}
    </div>
    <div className="mini-slots">
      {slots.map((slot) => {
        if (slot.empty) return <button className="mini-slot empty">·</button>;
        return <button className="mini-slot" data-click={slot.click || undefined} data-idx={slot.click ? slot.index : undefined} aria-label={slot.title}>{slot.glyph}<small>{slot.label}</small></button>;
      })}
    </div>
  </>;
}
