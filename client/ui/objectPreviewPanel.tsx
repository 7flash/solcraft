// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { objectPreviewActionLabel, objectPreviewDescription, objectPreviewGlyph, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewTitle } from "./objectPreviewPanelModel";

const BUILD_CHOICES = [
  ["cottage", "House", "🏠", "Expands your settlement and supports future services."],
  ["lumber", "Lumber Camp", "🪵", "Improves wood gathering and frontier growth."],
  ["quarry", "Mine", "⛏", "Improves stone gathering and building flow."],
  ["farm", "Farm", "🌾", "Grows crops; food restores health over time."],
  ["market", "Market", "🪙", "Turns settlement activity into coins."],
];

export function ObjectPreviewPanelView({ preview }: any) {
  const p = preview || null;
  if (!p) return <div />;
  const title = objectPreviewTitle(p);
  const glyph = objectPreviewGlyph(p);
  const primary = objectPreviewPrimaryAction(p);
  const desc = objectPreviewDescription(p);
  const showPrimary = objectPreviewShouldShowPrimary(p);
  return <div className="utility-pop object-preview-pop" data-stop-pointerdown="1">
    <button className="utility-close" data-click="object-preview-close">×</button>
    <div className="mini3d-preview object-preview-stage" data-mini3d-preview="1" data-preview-kind={p.kind} aria-label={`${title} 3D preview`}><span>{glyph}</span></div>
    <div className="inspect-head">
      <span className="accent-orb" />
      <div className="inspect-name">{title}</div>
      <span className="stat">{p.x},{p.z}</span>
    </div>
    <div className="owner-card ui45-preview-summary">
      <div>
        <div className="card-title">{p.kind === "npc" ? (p.title || "Wanderer") : p.kind === "food" ? "Farm crop" : p.kind === "tile" ? "Walkable ground" : p.kind === "trade" ? "World service" : "World object"}</div>
        <div className="tiny">{desc}</div>
      </div>
    </div>
    {p.kind === "keep" && (p.maxHp || p.coins) ? <div className="ui35-rally-strip" aria-label="Shared keep rally details">
      {p.maxHp ? <span><b>{Math.max(0, Math.floor(Number(p.hp || 0)))}/{Math.floor(Number(p.maxHp || 0))}</b><em>HP when shared</em></span> : null}
      {p.coins ? <span><b>{Math.floor(Number(p.coins || 0))}🪙</b><em>reported inside</em></span> : null}
    </div> : null}
    {p.kind === "buildTile" ? <div className="ui44-build-choices" aria-label="Choose building for selected tile">
      {BUILD_CHOICES.map(([id, name, icon, text]) => <button className="ui44-build-choice" data-click="build-tile-choice" data-id={id}>
        <b><span>{icon}</span>{name}</b>
        <small>{text}</small>
      </button>)}
    </div> : null}
    <div className="inspect-actions ui45-object-actions">
      {p.kind === "npc" ? <>
        <button className="btn primary" data-click="object-preview-primary" data-object-action="attack-npc">Attack</button>
        <button className="btn" data-click="object-preview-primary" data-object-action="donate-npc">Donate</button>
        <button className="btn" data-click="object-preview-walk-near">Walk near</button>
      </> : showPrimary && p.kind !== "buildTile" ? <button className="btn primary" data-click="object-preview-primary" data-object-action={primary}>{objectPreviewActionLabel(primary)}</button> : null}
    </div>
  </div>;
}
