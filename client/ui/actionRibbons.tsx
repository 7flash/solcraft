// @ts-nocheck
/** @jsxImportSource tradjs/client */
import {
  WORLD_WONDER_GOLD_COST,
} from "@server/shared";
import { buildChoiceState } from "./actionRibbonModel";
import { t } from "../i18n";

export function ActionRibbon(props: any) {
  const {
    mode,
    admin,
    m,
    state,
    buildables,
    liveE,
    costStr,
    craftedToolCount,
    currentWonderSize,
    currentWonderMode,
    currentWonderPalette,
    currentWonderNameFallback,
    wonderBuildMsClient,
    wonderTilesClient,
    cleanWonderPromptClient,
    normalBuildMsClient,
    buildingStatsLine,
    padRequirementLine,
    buildingRoleLine,
    missingCostLine,
    wonderFootprintChoices,
    wonderModeChoices,
    wonderPalettes,
  } = props;

  const liveEnergy = Number(liveE?.() || 0);
  const adminOpen = !!admin && mode === "admin";
  const showWonderQuick = mode === "wonder";
  const buildOpen = mode === "build";
  const craftOpen = mode === "craft";
  const spawnOpen = mode === "spawn";
  const toolsOpen = mode === "tools";
  const teleportOpen = mode === "teleport";
  const useOpen = mode === "use";

  const wonderQuick = showWonderQuick ? <div className="wonder-inline-planner wonder-action-ribbon">
    <div className="wonder-inline-head"><b>{t("ribbon.worldWonder", "★ World Wonder")}</b><span>{currentWonderSize()}×{currentWonderSize()} · {wonderTilesClient(currentWonderSize())} {t("ribbon.tiles", "tiles")} · ~{Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s</span></div>
    <div className="wonder-line-row">
      <input className="wonder-prompt-line" maxlength="180" value={state.wonderPrompt || ""} data-input="wonder-prompt" placeholder={t("ribbon.wonderPlaceholder", "Describe the landmark: school, dish, observatory, market...")} />
      <span className={"wonder-live-status" + (state.wonderBusy || state.wonderPlacing ? " busy" : "")}>{state.wonderPlacing ? t("ribbon.wonderFounding", "Founding…") : state.wonderBusy ? t("ribbon.wonderGenerating", "Generating…") : cleanWonderPromptClient(state.wonderPrompt) ? t("ribbon.wonderClickMap", "Click map to found") : t("ribbon.wonderTypePrompt", "Type prompt first")}</span>
    </div>
    <div className="wonder-line-row small">
      <span className="usetag">{t("ribbon.size", "Size")}</span>{wonderFootprintChoices.map((sz) => <button className={"btn mini" + (currentWonderSize() === sz ? " primary" : "")} data-click="wonder-footprint" data-size={sz}>{sz}×{sz}</button>)}
      <span className="usetag">{t("ribbon.mode", "Mode")}</span>{wonderModeChoices.map((mo) => <button className={"btn mini" + (currentWonderMode() === mo.id ? " primary" : "")} data-click="wonder-mode" data-mode={mo.id}>{mo.id === "single" ? t("ribbon.single", "Single") : t("ribbon.district", "District")}</button>)}
      <span className="usetag">{t("ribbon.colors", "Colors")}</span>{wonderPalettes.map((pal) => <button className={"btn mini swatch-btn" + (currentWonderPalette().id === pal.id ? " primary" : "")} data-click="wonder-palette" data-palette={pal.id} title={pal.name}>{pal.name.replace(/ .*/, "")}</button>)}
    </div>
    <div className="tiny"><b>{currentWonderNameFallback()}</b> · {WORLD_WONDER_GOLD_COST}🪙 · {t("ribbon.foundValidTile", "click a valid tile to found.")} {state.wonderMsg ? ` ${state.wonderMsg}` : ""}</div>
  </div> : null;

  if (adminOpen) return <div className="build-ribbon admin-ribbon">
    <div className="build-sep"><b>{t("ribbon.adminTitle", "Admin world ops")}</b><small>{t("ribbon.adminText", "world cleanup and event spawning")}</small></div>
    <div className="wonder-line-row small">
      <button className={"btn" + (state.adminTool === "demolish" ? " primary" : "")} data-click="admin-tool" data-tool="demolish">{t("ribbon.adminDemolish", "Demolish clicked object")}</button>
      <button className={"btn" + (state.adminTool === "spawnKeep" ? " primary" : "")} data-click="admin-tool" data-tool="spawnKeep">{t("ribbon.adminSpawnKeep", "Spawn Keep on click")}</button>
      <button className="btn" data-click="admin-demolish-here">{t("ribbon.adminClearObject", "Clear object here")}</button>
      <button className="btn danger" data-click="admin-clear-tile-here">{t("ribbon.adminClearTile", "Clear tile here")}</button>
      <button className="btn primary" data-click="admin-spawn-keep" data-mode="here">{t("ribbon.adminKeepHere", "Keep here")}</button>
      <button className="btn" data-click="admin-spawn-keep" data-mode="ring">{t("ribbon.adminFourKeeps", "4 Keeps around me")}</button>
      <button className="btn" data-click="open-world-map">{t("ribbon.adminWorldMap", "World map / jump")}</button>
    </div>
    <div className="tiny">{state.adminMsg || t("ribbon.adminHint", "Click Admin, choose demolish or spawn, then click the map. Small minimap ignores far outlier Keeps; expanded World Map still shows everything.")}</div>
  </div>;

  if (showWonderQuick) return <div className="build-ribbon wonder-only-ribbon">{wonderQuick}</div>;


  if (toolsOpen) return <div className="build-ribbon tools-ribbon ui2-top-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      <div className="build-sep"><b>{t("ribbon.toolsTitle", "Tools")}</b><small>{t("ribbon.toolsText", "choose what your click does")}</small></div>
      <button className={"build-tile" + (state.tool === "wood" ? " on" : "")} aria-label={t("ribbon.axeAria", "Axe — chop trees")} data-tip-title={t("ribbon.axeTipTitle", "🪓 Axe")} data-tip-body={t("ribbon.axeTipBody", "Highlight trees and click one to chop. Lumber Camps create more trees.")} data-click="gather-wood">
        <span className="bg">🪓</span><span className="bn">{t("ribbon.axeLabel", "Axe")}</span><span className="bc">{t("ribbon.axeAction", "Chop trees")}</span>
      </button>
      <button className={"build-tile" + (state.tool === "stone" ? " on" : "")} aria-label={t("ribbon.pickaxeAria", "Pickaxe — mine rocks")} data-tip-title={t("ribbon.pickaxeTipTitle", "⛏ Pickaxe")} data-tip-body={t("ribbon.pickaxeTipBody", "Highlight rocks and click one to mine. Quarries expose fresh stone.")} data-click="gather-stone">
        <span className="bg">⛏</span><span className="bn">{t("ribbon.pickaxeLabel", "Pickaxe")}</span><span className="bc">{t("ribbon.pickaxeAction", "Mine rocks")}</span>
      </button>
      <button className={"build-tile" + (state.tool === "use" ? " on" : "")} aria-label={t("ribbon.useAria", "Use — interact with buildings and supplies")} data-tip-title={t("ribbon.useTipTitle", "✦ Use")} data-tip-body={t("ribbon.useTipBody", "Click nearby buildings, consume usable items, or interact with trade posts.")} data-click="use-tool">
        <span className="bg">✦</span><span className="bn">{t("ribbon.useLabel", "Use")}</span><span className="bc">{t("ribbon.useAction", "Interact")}</span>
      </button>
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (teleportOpen) {
    const wonders = Array.isArray(m?.wonders) ? m.wonders : [];
    const houses = Array.isArray(m?.houses) ? m.houses : [];
    return <div className="build-ribbon teleport-ribbon ui2-top-ribbon">
      <div id="sc-build-strip" className="build-strip" data-build-strip="1">
        <div className="build-sep"><b>{t("ribbon.teleportTitle", "Teleport")}</b><small>{t("ribbon.teleportText", "settlement and unlocked wonders")}</small></div>
        <button className="build-tile on" aria-label={t("ribbon.homeAria", "Home base — return to your settlement flag")} data-tip-title={t("ribbon.homeTipTitle", "✦ Home base")} data-tip-body={t("ribbon.homeTipBody", "Cast briefly, then return to your settlement flag. Moving cancels the cast.")} data-click="home-cast">
          <span className="bg">✦</span><span className="bn">{t("ribbon.homeLabel", "Home Base")}</span><span className="bc">{t("ribbon.homeAction", "Settlement flag")}</span>
        </button>
        {houses.map((h: any) => <button className="build-tile" aria-label={`Teleport to House ${h.x},${h.z}`} data-tip-title={t("ribbon.houseTip", "🏠 House travel")} data-tip-body={t("ribbon.houseTravelTip", "Houses are normal travel points between your settlements.")} data-click="house-teleport" data-uid={h.uid}>
          <span className="bg">🏠</span><span className="bn">{h.name || `House ${h.x},${h.z}`}</span><span className="bc">{t("ribbon.houseTravel", "House travel")}</span>
        </button>)}
        {wonders.map((w: any) => <button className="build-tile" aria-label={`Teleport to ${w.name || `Wonder ${w.x},${w.z}`}`} data-tip-title={t("ribbon.worldWonderTip", "★ World Wonder")} data-tip-body={t("ribbon.wonderTravelTip", "Travel to an unlocked Wonder landmark.")} data-click="wonder-teleport" data-uid={w.uid}>
          <span className="bg">★</span><span className="bn">{w.name || `Wonder ${w.x},${w.z}`}</span><span className="bc">{t("ribbon.wonderTravel", "Wonder travel")}</span>
        </button>)}
        {!wonders.length && !houses.length ? <button className="build-tile" disabled aria-label={t("ribbon.noWondersAria", "No travel points yet")}>
          <span className="bg">◇</span><span className="bn">{t("ribbon.noWonders", "No travel points yet")}</span><span className="bc">{t("ribbon.exploreFound", "Build a House")}</span>
        </button> : null}
      </div>
      <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
    </div>;
  }

  if (buildOpen) return <div className="build-ribbon build-flow-ribbon">
    <div className="build-sep"><b>{t("ribbon.buildFlowTitle", "Hammer selected")}</b><small>{t("ribbon.buildFlowText", "Click an empty owned tile. The right-side build panel opens there.")}</small></div>
    <button className="build-tile on" disabled aria-label={t("ribbon.buildFlowAria", "Choose an owned empty tile to build") }>
      <span className="bg">▦</span><span className="bn">{t("ribbon.buildFlowTile", "Owned empty tile")}</span><span className="bc">{t("ribbon.buildFlowDirect", "Direct construction · no foundations")}</span>
    </button>
  </div>;

  if (craftOpen || spawnOpen) return <div className="build-ribbon craft-ribbon"><div className="build-sep"><b>Unavailable</b><small>Crafting, bombs, packs, and deployables are unavailable.</small></div></div>;

  if (useOpen) return <div className="build-ribbon use-ribbon"><div className="build-sep"><b>{t("ribbon.useTitle", "Use")}</b><small>Use nearby buildings from their preview. Return home from travel controls.</small></div></div>;


  return null;
}