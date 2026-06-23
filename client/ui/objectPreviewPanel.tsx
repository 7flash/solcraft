// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { objectPreviewActionLabel, objectPreviewDescription, objectPreviewGlyph, objectPreviewPrimaryAction, objectPreviewShouldShowPrimary, objectPreviewTitle } from "./objectPreviewPanelModel";
import { BUILDING_POLISH, costLine } from "./productionPolish";
import { LIB_BY_ID } from "@server/shared";

const BUILD_CHOICE_IDS = ["cottage", "lumber", "quarry", "farm", "warehouse"] as const;
function buildChoice(id: string) {
  const def = (LIB_BY_ID as any)?.[id] || {};
  const polish = BUILDING_POLISH[id] || {};
  return {
    id,
    name: def.name || (id === "cottage" ? "House" : id),
    icon: def.glyph || (id === "cottage" ? "🏠" : id === "lumber" ? "🪵" : id === "quarry" ? "⛏" : id === "farm" ? "🌾" : "▣"),
    cost: def.cost || {},
    info: polish,
  };
}

function hasCoords(p: any) {
  return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z));
}
function isServicePreview(p: any) {
  const k = String(p?.kind || p?.service || "").toLowerCase();
  const name = String(p?.name || p?.title || "").toLowerCase();
  return ["trade", "bank", "vault", "customizer", "tailor", "townhall", "guide", "service"].some((v) => k.includes(v) || name.includes(v));
}

export function ObjectPreviewPanelView({ preview }: any) {
  const p = preview || null;
  if (!p) return <div />;
  const title = objectPreviewTitle(p);
  const glyph = objectPreviewGlyph(p);
  const primary = objectPreviewPrimaryAction(p);
  const desc = objectPreviewDescription(p);
  const showPrimary = objectPreviewShouldShowPrimary(p);
  const service = isServicePreview(p);
  return <div className="utility-pop object-preview-pop" data-stop-pointerdown="1" data-service-preview={service ? "1" : "0"} data-kind={String(p.kind || "")}> 
    <button className="utility-close" data-click="object-preview-close" aria-label="Close preview">×</button>
    <div className="mini3d-preview object-preview-stage" data-mini3d-preview="1" data-preview-kind={p.kind} aria-label={`${title} 3D preview`}><span>{glyph}</span></div>
    {service ? <div className="owner-card ui45-preview-summary service-preview-card"><b>{glyph} {title}</b><small>Capital service building</small></div> : null}
    <div className="inspect-head">
      <span className="accent-orb" />
      <div className="inspect-name">{title}</div>
      {hasCoords(p) ? <span className="stat">{Math.trunc(Number(p.x))},{Math.trunc(Number(p.z))}</span> : null}
    </div>
    <div className="owner-card ui45-preview-summary">
      <div>
        <div className="card-title">{p.kind === "npc" ? (p.title || "Wanderer") : p.kind === "food" ? "Farm crop" : p.kind === "tile" ? "Walkable ground" : service ? "World service" : "World object"}</div>
        <div className="tiny">{desc}</div>
      </div>
    </div>
    {p.kind === "buildTile" ? <div className="build-first-rule"><b>Build here</b><span>Choose a starter building for this empty captured tile. Warehouses increase shared storage; Houses become travel points.</span></div> : null}
    {p.kind === "keep" && (p.maxHp || p.coins) ? <div className="ui35-rally-strip" aria-label="Shared keep rally details">
      {p.maxHp ? <span><b>{Math.max(0, Math.floor(Number(p.hp || 0)))}/{Math.floor(Number(p.maxHp || 0))}</b><em>HP when shared</em></span> : null}
      {p.coins ? <span><b>{Math.floor(Number(p.coins || 0))}🪙</b><em>reported inside</em></span> : null}
    </div> : null}
    {p.kind === "buildTile" ? <div className="ui44-build-choices" aria-label="Choose building for selected tile">
      {BUILD_CHOICE_IDS.map((id) => {
        const { name, icon, cost, info } = buildChoice(id);
        return <button className="ui44-build-choice production-build-choice" data-click="build-tile-choice" data-id={id} data-tip-title={`${icon} ${name}`} data-tip-body={`${info.purpose || "City infrastructure"} Cost: ${costLine(cost)}. Requires: ${info.requires || "captured tile"}.`}>
          <b><span>{icon}</span>{name}</b>
          <small>{info.purpose || "City infrastructure."}</small>
          <em>Cost: {costLine(cost)}</em>
        </button>;
      })}
    </div> : null}
    <div className="inspect-actions ui45-object-actions">
      {hasCoords(p) ? <button className="btn" data-click="object-preview-share">Share location</button> : null}
      {p.kind === "npc" ? <>
        <button className="btn" data-click="object-preview-action" data-object-action="walk-near">Walk near</button>
        <button className="btn primary" data-click="object-preview-action" data-object-action="talk-npc">Talk</button>
        <button className="btn" data-click="object-preview-action" data-object-action="donate-npc">Donate</button>
        <button className="btn danger" data-click="object-preview-action" data-object-action="attack-npc">Attack</button>
      </> : null}
      {p.kind === "keep" ? <>
        <button className="btn" data-click="object-preview-action" data-object-action="walk">Walk here</button>
        <button className="btn" data-click="object-preview-action" data-object-action="donate-keep">Donate</button>
        <button className="btn danger" data-click="object-preview-action" data-object-action="raid-keep">Raid</button>
      </> : null}
      {service ? <>
        <button className="btn primary service-action-disabled" disabled aria-disabled="true" title="Open this service from the capital panel.">Open service</button>
        <button className="btn service-action-disabled" disabled aria-disabled="true" title="More actions will appear here when available.">Service actions</button>
        <button className="btn service-action-disabled" disabled aria-disabled="true" title="More details will appear here when available.">Details</button>
      </> : null}
      {showPrimary && !service ? <button className="btn primary" data-click="object-preview-primary" data-object-action={primary}>{objectPreviewActionLabel(primary)}</button> : null}
      {p.kind === "tile" || p.kind === "shared" ? <button className="btn primary" data-click="object-preview-action" data-object-action="walk">Walk here</button> : null}
    </div>
  </div>;
}
