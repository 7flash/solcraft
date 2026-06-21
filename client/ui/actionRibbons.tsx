// @ts-nocheck
/** @jsxImportSource tradjs/client */
import {
  COSTI,
  DESTROY_TOOLS,
  RECIPES,
  USE_ITEMS,
  WORLD_WONDER_GOLD_COST,
} from "@server/shared";
import { buildChoiceState, craftedToolOwnedCount, missingCostKeys, usablePackItems } from "./actionRibbonModel";
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
  const ownedToolCount = (id: string) => typeof craftedToolCount === "function" ? craftedToolCount(id) : craftedToolOwnedCount(m?.pack, id);
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
    <div className="build-sep"><b>{t("ribbon.adminTitle", "Admin world ops")}</b><small>{t("ribbon.adminText", "server-authoritative cleanup and event spawning")}</small></div>
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
      <button className="build-tile" aria-label={t("ribbon.craftAria", "Craft — make tools and supplies")} data-tip-title={t("ribbon.craftTipTitle", "🧪 Craft")} data-tip-body={t("ribbon.craftTipBody", "Craft gear, elixirs, and deployable tools.")} data-click="select-craft">
        <span className="bg">🧪</span><span className="bn">{t("ribbon.craftLabel", "Craft")}</span><span className="bc">{t("ribbon.craftAction", "Supplies")}</span>
      </button>
      <button className="build-tile" aria-label={t("ribbon.deployAria", "Deploy — place crafted tools")} data-tip-title={t("ribbon.deployTipTitle", "⚒ Deploy")} data-tip-body={t("ribbon.deployTipBody", "Select crafted deployables, then click a valid tile.")} data-click="select-spawn-tool">
        <span className="bg">⚒</span><span className="bn">{t("ribbon.deployLabel", "Deploy")}</span><span className="bc">{t("ribbon.deployAction", "Crafted tools")}</span>
      </button>
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (teleportOpen) {
    const wonders = Array.isArray(m?.wonders) ? m.wonders : [];
    return <div className="build-ribbon teleport-ribbon ui2-top-ribbon">
      <div id="sc-build-strip" className="build-strip" data-build-strip="1">
        <div className="build-sep"><b>{t("ribbon.teleportTitle", "Teleport")}</b><small>{t("ribbon.teleportText", "settlement and unlocked wonders")}</small></div>
        <button className="build-tile on" aria-label={t("ribbon.homeAria", "Home base — return to your settlement flag")} data-tip-title={t("ribbon.homeTipTitle", "✦ Home base")} data-tip-body={t("ribbon.homeTipBody", "Cast briefly, then return to your settlement flag. Moving cancels the cast.")} data-click="home-cast">
          <span className="bg">✦</span><span className="bn">{t("ribbon.homeLabel", "Home Base")}</span><span className="bc">{t("ribbon.homeAction", "Settlement flag")}</span>
        </button>
        {wonders.map((w: any) => <button className="build-tile" aria-label={`Teleport to ${w.name || `Wonder ${w.x},${w.z}`}`} data-tip-title={t("ribbon.worldWonderTip", "★ World Wonder")} data-tip-body={t("ribbon.wonderTravelTip", "Travel to an explored/unlocked Wonder. Wonder taxes can be balanced server-side later.")} data-click="wonder-teleport" data-uid={w.uid}>
          <span className="bg">★</span><span className="bn">{w.name || `Wonder ${w.x},${w.z}`}</span><span className="bc">{t("ribbon.wonderTravel", "Wonder travel")}</span>
        </button>)}
        {!wonders.length ? <button className="build-tile" disabled aria-label={t("ribbon.noWondersAria", "No World Wonders unlocked yet")}>
          <span className="bg">◇</span><span className="bn">{t("ribbon.noWonders", "No Wonders yet")}</span><span className="bc">{t("ribbon.exploreFound", "Explore/found one")}</span>
        </button> : null}
      </div>
      <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
    </div>;
  }

  if (buildOpen) return <div className="build-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      {(buildables || []).filter((b) => b.id !== "worldwonder").map((b) => {
        const choice = buildChoiceState(b, m, liveEnergy, state.placing, WORLD_WONDER_GOLD_COST);
        const missingLine = choice.needsWonderGold ? `Need ${WORLD_WONDER_GOLD_COST - (m?.inv?.g || 0)}🪙 more` : missingCostLine(b.cost, m);
        const lockLine = choice.locked ? `Unlocks at ${b.unlock} claimed tiles. You have ${m?.territory || 0}.` : "";
        return <button className={"build-tile" + (choice.active ? " on" : "") + (choice.disabled ? " locked" : "")} aria-disabled={choice.disabled} aria-label={`${b.name} — ${buildingStatsLine(b)}`} data-tip-title={`${b.glyph} ${b.name}`} data-tip-body={`${b.blurb || t("ribbon.decoration", "Decoration")} · ${buildingStatsLine(b)} · ${padRequirementLine(b)}${lockLine ? ` · ${lockLine}` : ""}${missingLine ? ` · ${missingLine}` : ""}`} data-click="select-building" data-id={b.id}>
          <span className="bg">{b.glyph}</span><span className="bn">{b.name}</span><span className="bc">{b.id === "worldwonder" ? `${WORLD_WONDER_GOLD_COST}🪙 · AI Wonder` : choice.locked ? `${b.unlock} tiles` : choice.missing.length ? missingLine : `${costStr(b.cost) || t("ribbon.free", "Free")} · ${b.hp || 220}HP`}</span><span className="bc">{b.id === "worldwonder" ? `${t("ribbon.planner", "Planner")} · ${currentWonderSize()}×${currentWonderSize()} · ${Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s` : `${buildingRoleLine(b)} · ${Math.round(normalBuildMsClient(b) / 1000)}s ${t("ribbon.buildSuffix", "build")}`}</span>
        </button>;
      })}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (craftOpen) return <div className="build-ribbon craft-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      <div className="build-sep"><b>{t("ribbon.craftDeployables", "Craft deployables")}</b><small>{t("ribbon.scienceSiege", "science-only siege tools")}</small></div>
      {DESTROY_TOOLS.map((b) => {
        const miss = missingCostKeys(b.cost, m, liveEnergy);
        return <button className={"build-tile" + (miss.length > 0 ? " locked" : "")} aria-disabled={miss.length > 0} aria-label={`Craft ${b.name} — ${b.blurb}`} data-tip-title={`${t("ribbon.craft", "Craft")} ${b.glyph} ${b.name}`} data-tip-body={`${b.blurb} · ${t("ribbon.scienceOnly", "Science-only")} · ${t("ribbon.cost", "Cost")}: ${costStr(b.cost)} · ${t("ribbon.owned", "Owned")} ${ownedToolCount(b.id)}`} data-click="make-bomb" data-id={b.id}>
          <span className="bg">{b.glyph}</span><span className="bn">{t("ribbon.craft", "Craft")} {b.name}</span><span className="bc">{miss.length ? t("ribbon.need", "Need") + " " + miss.map((r) => COSTI[r]).join(" ") : `${t("ribbon.science", "Science")}: ${costStr(b.cost)} · ${t("ribbon.you", "You")}: ${ownedToolCount(b.id)}`}</span>
        </button>;
      })}
      <div className="build-sep"><b>{t("ribbon.craftGear", "Craft gear & supplies")}</b><small>{t("ribbon.scienceLoadout", "science-only loadout")}</small></div>
      {RECIPES.map((r) => {
        const miss = missingCostKeys(r.cost, m, liveEnergy);
        return <button className={"build-tile" + (miss.length > 0 ? " locked" : "")} aria-disabled={miss.length > 0} aria-label={`Craft ${r.name} — ${r.blurb}`} data-tip-title={`${r.glyph} ${r.name}`} data-tip-body={`${r.blurb} · ${t("ribbon.scienceOnly", "Science-only")} · ${t("ribbon.cost", "Cost")}: ${costStr(r.cost)}`} data-click="craft-recipe" data-id={r.id}>
          <span className="bg">{r.glyph}</span><span className="bn">{r.name}</span><span className="bc">{miss.length ? t("ribbon.need", "Need") + " " + miss.map((k) => COSTI[k]).join(" ") : `${t("ribbon.science", "Science")}: ${costStr(r.cost)}`}</span>
        </button>;
      })}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (spawnOpen) return <div className="build-ribbon destroy-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      {DESTROY_TOOLS.map((b) => {
        const owned = ownedToolCount(b.id);
        const active = state.destroying === b.id;
        return <button className={"build-tile" + (active ? " on" : "") + (owned <= 0 ? " locked" : "")} aria-disabled={owned <= 0} aria-label={`${b.name} — ${b.blurb}`} data-tip-title={`Deploy ${b.glyph} ${b.name}`} data-tip-body={`${b.blurb} · ${t("ribbon.target", "Target")}: ${b.target || t("ribbon.territory", "territory")} · ${t("ribbon.owned", "Owned")} ${owned} · ${Math.round(b.fuseMs / 1000)}s ${t("ribbon.fuse", "fuse")}`} data-click="select-spawn" data-id={b.id}>
          <span className="bg">{b.glyph}</span><span className="bn">{b.name}</span><span className="bc">{owned > 0 ? `${t("ribbon.ownedShort", "Owned")}: ${owned} · ${Math.round(b.fuseMs / 1000)}s` : t("ribbon.craftFirst", "Craft first")}</span>
        </button>;
      })}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (useOpen) return <div className="build-ribbon use-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      <div className="build-sep"><b>{t("ribbon.useTitle", "Use")}</b><small>{t("ribbon.useText", "scrolls & supplies")}</small></div>
      <button className="build-tile on" aria-label={t("ribbon.returnScrollAria", "Return Scroll — infinite teleport to your flag after casting")} data-tip-title={t("ribbon.returnScrollTitle", "✦ Return Scroll")} data-tip-body={t("ribbon.returnScrollTip", "Infinite use. Stand still through the cast to return to your flag.")} data-click="home-cast">
        <span className="bg">✦</span><span className="bn">{t("ribbon.returnScroll", "Return Scroll")}</span><span className="bc">{t("ribbon.infiniteDelay", "Infinite · cast delay")}</span>
      </button>
      {usablePackItems(m).map(({ item, index }) => {
        const u = USE_ITEMS[item.id];
        return <button className="build-tile" aria-label={`${u?.name || item.id} — ${u?.blurb || t("ribbon.usableItem", "Usable item")}`} data-tip-title={`${u?.glyph || "✦"} ${u?.name || item.id}`} data-tip-body={u?.blurb || t("ribbon.useCraftedItem", "Use this crafted item.")} data-click="use-pack-slot" data-idx={index}>
          <span className="bg">{u?.glyph || "✦"}</span><span className="bn">{u?.name || item.id}</span><span className="bc">{t("ribbon.backpackSlot", "Backpack slot {slot}", { slot: index + 1 })}</span>
        </button>;
      })}
      {usablePackItems(m).length === 0 ? <button className="build-tile" disabled aria-label={t("ribbon.craftElixirs", "Craft elixirs from Craft")}>
        <span className="bg">🧪</span><span className="bn">{t("ribbon.noCraftedItems", "No crafted items")}</span><span className="bc">{t("ribbon.craftElixirsFirst", "Craft elixirs first")}</span>
      </button> : null}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  return null;
}