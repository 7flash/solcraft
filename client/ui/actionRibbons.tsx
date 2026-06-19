// @ts-nocheck
/** @jsxImportSource tradjs/client */
import {
  COSTI,
  DESTROY_TOOLS,
  RECIPES,
  USE_ITEMS,
  WORLD_WONDER_GOLD_COST,
} from "../../game/shared";
import { buildChoiceState, craftedToolOwnedCount, missingCostKeys, usablePackItems } from "./actionRibbonModel";

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
    <div className="wonder-inline-head"><b>★ World Wonder</b><span>{currentWonderSize()}×{currentWonderSize()} · {wonderTilesClient(currentWonderSize())} tiles · ~{Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s</span></div>
    <div className="wonder-line-row">
      <input className="wonder-prompt-line" maxlength="180" value={state.wonderPrompt || ""} data-input="wonder-prompt" placeholder="Describe the landmark: school, dish, observatory, market..." />
      <span className={"wonder-live-status" + (state.wonderBusy || state.wonderPlacing ? " busy" : "")}>{state.wonderPlacing ? "Founding…" : state.wonderBusy ? "Generating…" : cleanWonderPromptClient(state.wonderPrompt) ? "Click map to found" : "Type prompt first"}</span>
    </div>
    <div className="wonder-line-row small">
      <span className="usetag">Size</span>{wonderFootprintChoices.map((sz) => <button className={"btn mini" + (currentWonderSize() === sz ? " primary" : "")} data-click="wonder-footprint" data-size={sz}>{sz}×{sz}</button>)}
      <span className="usetag">Mode</span>{wonderModeChoices.map((mo) => <button className={"btn mini" + (currentWonderMode() === mo.id ? " primary" : "")} data-click="wonder-mode" data-mode={mo.id}>{mo.id === "single" ? "Single" : "District"}</button>)}
      <span className="usetag">Colors</span>{wonderPalettes.map((pal) => <button className={"btn mini swatch-btn" + (currentWonderPalette().id === pal.id ? " primary" : "")} data-click="wonder-palette" data-palette={pal.id} title={pal.name}>{pal.name.replace(/ .*/, "")}</button>)}
    </div>
    <div className="tiny"><b>{currentWonderNameFallback()}</b> · {WORLD_WONDER_GOLD_COST}🪙 · click a valid tile to found. {state.wonderMsg ? ` ${state.wonderMsg}` : ""}</div>
  </div> : null;

  if (adminOpen) return <div className="build-ribbon admin-ribbon">
    <div className="build-sep"><b>Admin world ops</b><small>server-authoritative cleanup and event spawning</small></div>
    <div className="wonder-line-row small">
      <button className={"btn" + (state.adminTool === "demolish" ? " primary" : "")} data-click="admin-tool" data-tool="demolish">Demolish clicked object</button>
      <button className={"btn" + (state.adminTool === "spawnKeep" ? " primary" : "")} data-click="admin-tool" data-tool="spawnKeep">Spawn Keep on click</button>
      <button className="btn" data-click="admin-demolish-here">Clear object here</button>
      <button className="btn danger" data-click="admin-clear-tile-here">Clear tile here</button>
      <button className="btn primary" data-click="admin-spawn-keep" data-mode="here">Keep here</button>
      <button className="btn" data-click="admin-spawn-keep" data-mode="ring">4 Keeps around me</button>
      <button className="btn" data-click="open-world-map">World map / jump</button>
    </div>
    <div className="tiny">{state.adminMsg || "Click Admin, choose demolish or spawn, then click the map. Small minimap ignores far outlier Keeps; expanded World Map still shows everything."}</div>
  </div>;

  if (showWonderQuick) return <div className="build-ribbon wonder-only-ribbon">{wonderQuick}</div>;


  if (toolsOpen) return <div className="build-ribbon tools-ribbon ui2-top-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      <div className="build-sep"><b>Tools</b><small>choose what your click does</small></div>
      <button className={"build-tile" + (state.tool === "wood" ? " on" : "")} aria-label="Axe — chop trees" data-tip-title="🪓 Axe" data-tip-body="Highlight trees and click one to chop. Lumber Camps create more trees." data-click="gather-wood">
        <span className="bg">🪓</span><span className="bn">Axe</span><span className="bc">Chop trees</span>
      </button>
      <button className={"build-tile" + (state.tool === "stone" ? " on" : "")} aria-label="Pickaxe — mine rocks" data-tip-title="⛏ Pickaxe" data-tip-body="Highlight rocks and click one to mine. Quarries expose fresh stone." data-click="gather-stone">
        <span className="bg">⛏</span><span className="bn">Pickaxe</span><span className="bc">Mine rocks</span>
      </button>
      <button className={"build-tile" + (state.tool === "use" ? " on" : "")} aria-label="Use — interact with buildings and supplies" data-tip-title="✦ Use" data-tip-body="Click nearby buildings, consume usable items, or interact with trade posts." data-click="use-tool">
        <span className="bg">✦</span><span className="bn">Use</span><span className="bc">Interact</span>
      </button>
      <button className="build-tile" aria-label="Craft — make tools and supplies" data-tip-title="🧪 Craft" data-tip-body="Craft gear, elixirs, and deployable tools." data-click="select-craft">
        <span className="bg">🧪</span><span className="bn">Craft</span><span className="bc">Supplies</span>
      </button>
      <button className="build-tile" aria-label="Deploy — place crafted tools" data-tip-title="⚒ Deploy" data-tip-body="Select crafted deployables, then click a valid tile." data-click="select-spawn-tool">
        <span className="bg">⚒</span><span className="bn">Deploy</span><span className="bc">Crafted tools</span>
      </button>
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (teleportOpen) {
    const wonders = Array.isArray(m?.wonders) ? m.wonders : [];
    return <div className="build-ribbon teleport-ribbon ui2-top-ribbon">
      <div id="sc-build-strip" className="build-strip" data-build-strip="1">
        <div className="build-sep"><b>Teleport</b><small>settlement and unlocked wonders</small></div>
        <button className="build-tile on" aria-label="Home base — return to your settlement flag" data-tip-title="✦ Home base" data-tip-body="Cast briefly, then return to your settlement flag. Moving cancels the cast." data-click="home-cast">
          <span className="bg">✦</span><span className="bn">Home Base</span><span className="bc">Settlement flag</span>
        </button>
        {wonders.map((w: any) => <button className="build-tile" aria-label={`Teleport to ${w.name || `Wonder ${w.x},${w.z}`}`} data-tip-title="★ World Wonder" data-tip-body="Travel to an explored/unlocked Wonder. Wonder taxes can be balanced server-side later." data-click="wonder-teleport" data-uid={w.uid}>
          <span className="bg">★</span><span className="bn">{w.name || `Wonder ${w.x},${w.z}`}</span><span className="bc">Wonder travel</span>
        </button>)}
        {!wonders.length ? <button className="build-tile" disabled aria-label="No World Wonders unlocked yet">
          <span className="bg">◇</span><span className="bn">No Wonders yet</span><span className="bc">Explore/found one</span>
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
        return <button className={"build-tile" + (choice.active ? " on" : "") + (choice.disabled ? " locked" : "")} aria-disabled={choice.disabled} aria-label={`${b.name} — ${buildingStatsLine(b)}`} data-tip-title={`${b.glyph} ${b.name}`} data-tip-body={`${b.blurb || "Decoration"} · ${buildingStatsLine(b)} · ${padRequirementLine(b)}${lockLine ? ` · ${lockLine}` : ""}${missingLine ? ` · ${missingLine}` : ""}`} data-click="select-building" data-id={b.id}>
          <span className="bg">{b.glyph}</span><span className="bn">{b.name}</span><span className="bc">{b.id === "worldwonder" ? `${WORLD_WONDER_GOLD_COST}🪙 · AI Wonder` : choice.locked ? `${b.unlock} tiles` : choice.missing.length ? missingLine : `${costStr(b.cost) || "Free"} · ${b.hp || 220}HP`}</span><span className="bc">{b.id === "worldwonder" ? `Planner · ${currentWonderSize()}×${currentWonderSize()} · ${Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s` : `${buildingRoleLine(b)} · ${Math.round(normalBuildMsClient(b) / 1000)}s build`}</span>
        </button>;
      })}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (craftOpen) return <div className="build-ribbon craft-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      <div className="build-sep"><b>Craft deployables</b><small>science-only siege tools</small></div>
      {DESTROY_TOOLS.map((b) => {
        const miss = missingCostKeys(b.cost, m, liveEnergy);
        return <button className={"build-tile" + (miss.length > 0 ? " locked" : "")} aria-disabled={miss.length > 0} aria-label={`Craft ${b.name} — ${b.blurb}`} data-tip-title={`Craft ${b.glyph} ${b.name}`} data-tip-body={`${b.blurb} · Science-only · Cost: ${costStr(b.cost)} · Owned ${ownedToolCount(b.id)}`} data-click="make-bomb" data-id={b.id}>
          <span className="bg">{b.glyph}</span><span className="bn">Craft {b.name}</span><span className="bc">{miss.length ? "Need " + miss.map((r) => COSTI[r]).join(" ") : `Science: ${costStr(b.cost)} · You: ${ownedToolCount(b.id)}`}</span>
        </button>;
      })}
      <div className="build-sep"><b>Craft gear & supplies</b><small>science-only loadout</small></div>
      {RECIPES.map((r) => {
        const miss = missingCostKeys(r.cost, m, liveEnergy);
        return <button className={"build-tile" + (miss.length > 0 ? " locked" : "")} aria-disabled={miss.length > 0} aria-label={`Craft ${r.name} — ${r.blurb}`} data-tip-title={`${r.glyph} ${r.name}`} data-tip-body={`${r.blurb} · Science-only · Cost: ${costStr(r.cost)}`} data-click="craft-recipe" data-id={r.id}>
          <span className="bg">{r.glyph}</span><span className="bn">{r.name}</span><span className="bc">{miss.length ? "Need " + miss.map((k) => COSTI[k]).join(" ") : `Science: ${costStr(r.cost)}`}</span>
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
        return <button className={"build-tile" + (active ? " on" : "") + (owned <= 0 ? " locked" : "")} aria-disabled={owned <= 0} aria-label={`${b.name} — ${b.blurb}`} data-tip-title={`Deploy ${b.glyph} ${b.name}`} data-tip-body={`${b.blurb} · Target: ${b.target || "territory"} · Owned ${owned} · ${Math.round(b.fuseMs / 1000)}s fuse`} data-click="select-spawn" data-id={b.id}>
          <span className="bg">{b.glyph}</span><span className="bn">{b.name}</span><span className="bc">{owned > 0 ? `Owned: ${owned} · ${Math.round(b.fuseMs / 1000)}s` : "Craft first"}</span>
        </button>;
      })}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  if (useOpen) return <div className="build-ribbon use-ribbon">
    <div id="sc-build-strip" className="build-strip" data-build-strip="1">
      <div className="build-sep"><b>Use</b><small>scrolls & supplies</small></div>
      <button className="build-tile on" aria-label="Return Scroll — infinite teleport to your flag after casting" data-tip-title="✦ Return Scroll" data-tip-body="Infinite use. Stand still through the cast to return to your flag." data-click="home-cast">
        <span className="bg">✦</span><span className="bn">Return Scroll</span><span className="bc">Infinite · cast delay</span>
      </button>
      {usablePackItems(m).map(({ item, index }) => {
        const u = USE_ITEMS[item.id];
        return <button className="build-tile" aria-label={`${u?.name || item.id} — ${u?.blurb || "Usable item"}`} data-tip-title={`${u?.glyph || "✦"} ${u?.name || item.id}`} data-tip-body={u?.blurb || "Use this crafted item."} data-click="use-pack-slot" data-idx={index}>
          <span className="bg">{u?.glyph || "✦"}</span><span className="bn">{u?.name || item.id}</span><span className="bc">Backpack slot {index + 1}</span>
        </button>;
      })}
      {usablePackItems(m).length === 0 ? <button className="build-tile" disabled aria-label="Craft elixirs from Craft">
        <span className="bg">🧪</span><span className="bn">No crafted items</span><span className="bc">Craft elixirs first</span>
      </button> : null}
    </div>
    <div className="build-scroll-track"><i id="sc-build-scroll-thumb" /></div>
  </div>;

  return null;
}
