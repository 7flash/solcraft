// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { t, tArray } from "../i18n";
import { objectPreviewActionLabel, objectPreviewDescription, objectPreviewGlyph, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewSummaryTitle, objectPreviewTitle } from "./objectPreviewPanelModel";

const FALLBACK_BUILD_CHOICES = [
  { id: "cottage", name: "House", icon: "🏠", text: "Expands your settlement and supports future services." },
  { id: "lumber", name: "Lumber Camp", icon: "🪵", text: "Improves wood gathering and frontier growth." },
  { id: "quarry", name: "Mine", icon: "⛏", text: "Improves stone gathering and building flow." },
  { id: "farm", name: "Farm", icon: "🌾", text: "Grows crops; food restores health over time." },
  { id: "market", name: "Market", icon: "🪙", text: "Turns settlement activity into coins." },
];

function buildChoices() {
  return tArray("objectPreview.buildChoices", FALLBACK_BUILD_CHOICES);
}

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
    <div className="mini3d-preview object-preview-stage" data-mini3d-preview="1" data-preview-kind={p.kind} aria-label={t("objectPreview.aria.preview3d", "{title} 3D preview", { title })}><span>{glyph}</span></div>
    <div className="inspect-head">
      <span className="accent-orb" />
      <div className="inspect-name">{title}</div>
      <span className="stat">{p.x},{p.z}</span>
    </div>
    <div className="owner-card ui45-preview-summary">
      <div>
        <div className="card-title">{objectPreviewSummaryTitle(p)}</div>
        <div className="tiny">{desc}</div>
      </div>
    </div>
    {p.kind === "keep" && (p.maxHp || p.coins) ? <div className="ui35-rally-strip" aria-label={t("objectPreview.aria.keepRally", "Shared keep rally details")}>
      {p.maxHp ? <span><b>{Math.max(0, Math.floor(Number(p.hp || 0)))}/{Math.floor(Number(p.maxHp || 0))}</b><em>{t("objectPreview.keepHpLabel", "HP when shared")}</em></span> : null}
      {p.coins ? <span><b>{Math.floor(Number(p.coins || 0))}🪙</b><em>{t("objectPreview.keepCoinsLabel", "reported inside")}</em></span> : null}
    </div> : null}
    {p.kind === "buildTile" ? <div className="ui44-build-choices" aria-label={t("objectPreview.aria.chooseBuilding", "Choose building for selected tile")}>
      {buildChoices().map(({ id, name, icon, text }) => <button className="ui44-build-choice" data-click="build-tile-choice" data-id={id}>
        <b><span>{icon}</span>{name}</b>
        <small>{text}</small>
      </button>)}
    </div> : null}
    <div className="inspect-actions ui45-object-actions">
      {p.kind === "npc" ? <>
        <button className="btn primary" data-click="object-preview-primary" data-object-action="talk-npc">{t("objectPreview.npcTalk", "Talk")}</button>
        <button className="btn" data-click="object-preview-primary" data-object-action="donate-npc">{t("objectPreview.npcDonate", "Donate")}</button>
        <button className="btn danger" data-click="object-preview-primary" data-object-action="attack-npc">{t("objectPreview.npcAttack", "Attack")}</button>
        <button className="btn" data-click="object-preview-walk-near">{t("objectPreview.npcWalkNear", "Walk near")}</button>
      </> : showPrimary && p.kind !== "buildTile" ? <button className="btn primary" data-click="object-preview-primary" data-object-action={primary}>{objectPreviewActionLabel(primary)}</button> : null}
    </div>
  </div>;
}
