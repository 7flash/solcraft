// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { objectPreviewActionLabel, objectPreviewDescription, objectPreviewGlyph, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewTitle } from "./objectPreviewPanelModel";

function objectTypeLabel(p: any) {
  if (p.kind === "food") return "Farm crop";
  if (p.kind === "tile") return "Walkable ground";
  if (p.kind === "trade") return "World service";
  if (p.kind === "npc") return "Character";
  if (p.kind === "tree") return "Tree";
  if (p.kind === "rock") return "Rock";
  return "World object";
}

export function ObjectPreviewPanelView({ preview }: any) {
  const p = preview || null;
  if (!p) return <div />;
  const title = objectPreviewTitle(p);
  const glyph = objectPreviewGlyph(p);
  const primary = objectPreviewPrimaryAction(p);
  const desc = objectPreviewDescription(p);
  const showPrimary = objectPreviewShouldShowPrimary(p);
  return <aside className="utility-pop object-preview-pop ui30-panel ui30-object" data-stop-pointerdown="1">
    <button className="utility-close ui30-close" data-click="object-preview-close" aria-label="Close preview">×</button>
    <section className="ui30-preview-wrap">
      <div className="mini3d-preview object-preview-stage ui30-preview-stage" data-mini3d-preview="1" data-preview-kind={p.kind} aria-label={`${title} 3D preview`}><span>{glyph}</span></div>
    </section>
    <header className="ui30-inspect-head">
      <div className="ui30-title-mark" aria-hidden="true">{glyph}</div>
      <div><p>{objectTypeLabel(p)}</p><h2>{title}</h2></div>
      <span className="ui30-level-pill">{p.x},{p.z}</span>
    </header>
    <section className="ui30-summary-card"><p>{desc}</p></section>
    <section className="ui30-action-stack">
      {showPrimary ? <button className="ui30-btn primary" data-click="object-preview-primary" data-object-action={primary}>{objectPreviewActionLabel(primary)}</button> : null}
      <button className="ui30-btn" data-click="object-preview-walk-near">Walk near</button>
      <button className="ui30-btn" data-click="object-preview-close">Close</button>
    </section>
  </aside>;
}
