// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { t } from "../i18n";
import { objectPreviewActionLabel, objectPreviewDescription, objectPreviewGlyph, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewSummaryTitle, objectPreviewTitle } from "./objectPreviewPanelModel";
import { cleanBuildChoices, cleanBuildRoleLabel } from "./cleanBuildCatalog";

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
    {p.kind === "buildTile" ? <div className="ui44-build-choices ui26-clean-build-panel" aria-label={t("objectPreview.aria.chooseBuilding", "Choose building for selected tile")}>
      <div className="ui26-build-flow-note">
        <b>{t("build.flow.title", "Build here")}</b>
        <small>{t("build.flow.text", "Construction starts immediately. Foundations, bombs, crafting, and escrow systems are removed from this release.")}</small>
      </div>
      {cleanBuildChoices().map(({ id, name, icon, text, role }) => <button className="ui44-build-choice ui26-build-choice" data-click="build-tile-choice" data-id={id}>
        <b><span>{icon}</span>{name}<em>{cleanBuildRoleLabel(role)}</em></b>
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
