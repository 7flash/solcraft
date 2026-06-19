// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { objectPreviewDescription, objectPreviewGlyph, objectPreviewPrimaryAction, objectPreviewTitle } from "./objectPreviewPanelModel";

export function ObjectPreviewPanelView({ preview }: any) {
  const p = preview || null;
  if (!p) return <div />;
  const title = objectPreviewTitle(p);
  const glyph = objectPreviewGlyph(p);
  const primary = objectPreviewPrimaryAction(p);
  const desc = objectPreviewDescription(p);
  const actionText =
    primary === "select-axe" ? "Select axe" :
    primary === "select-pickaxe" ? "Select pickaxe" :
    primary === "harvest-food" ? "Harvest food" :
    primary === "open-trade" ? "Open exchange" :
    primary === "walk-near" ? "Walk near" :
    "Walk here";
  return <div className="utility-pop object-preview-pop" data-stop-pointerdown="1">
    <button className="utility-close" data-click="object-preview-close">×</button>
    <div className="object-preview-stage" aria-hidden="true"><span>{glyph}</span></div>
    <div className="inspect-head">
      <span className="accent-orb" />
      <div className="inspect-name">{title}</div>
      <span className="stat">{p.x},{p.z}</span>
    </div>
    <div className="owner-card">
      <div className="face-preview small empty"><span>{glyph}</span></div>
      <div>
        <div className="card-title">{p.kind === "food" ? "Farm crop" : p.kind === "tile" ? "Walkable ground" : "World object"}</div>
        <div className="tiny">{desc}</div>
      </div>
    </div>
    <div className="inspect-actions">
      <button className="btn primary" data-click="object-preview-primary" data-object-action={primary}>{actionText}</button>
      <button className="btn" data-click="object-preview-walk-near">Walk near</button>
      <button className="btn" data-click="object-preview-close">Close</button>
    </div>
  </div>;
}
