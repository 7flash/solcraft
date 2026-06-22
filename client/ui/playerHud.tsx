// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { playerHudViewModel } from "./playerHudModel";

function StatusBar({ label, icon, now, max, pct, id, tip }: any) {
  const width = `${Math.max(0, Math.min(100, Number(pct || 0))).toFixed(0)}%`;
  return <div className="player-hud__bar" title={tip || label} data-tip-title={label} data-tip-body={tip}>
    <div className="player-hud__bar-head"><b>{icon} {label}</b><span><span id={id}>{now}</span>/<em>{max}</em></span></div>
    <div className="player-hud__bar-track"><i style={{ width }} /></div>
  </div>;
}

function ResourcePill({ icon, label, value, cap, tip }: any) {
  const free = Math.max(0, Number(cap || 0) - Number(value || 0));
  return <div className="player-hud__resource" title={tip || label} data-tip-title={label} data-tip-body={tip}>
    <span className="player-hud__resource-icon">{icon}</span>
    <b>{value}</b>
    <em>{cap ? `${free} free` : "no cap"}</em>
  </div>;
}

export function PlayerHudView(props: any) {
  const vm = playerHudViewModel(props || {});
  return <aside className="scv-hud player-hud" aria-label="Player status">
    <header className="player-hud__header">
      <b className="player-hud__name" title={vm.name}>{vm.name}</b>
      <span className="player-hud__territory" title={vm.captureLimitText}>Tiles {vm.territory}/{vm.tileCap || "?"} · {vm.tileFree} left · Rep {vm.reputation}</span>
    </header>

    <section className="player-hud__bars">
      <StatusBar icon="⚡" label="Energy" now={vm.energyNow} max={vm.maxEnergy} pct={vm.energyPct} id="sc-e-now" tip="Energy limits gathering, claiming, building, and attacks." />
      <StatusBar icon="♥" label="Health" now={vm.hpNow} max={vm.maxHp} pct={vm.hpPct} id="sc-hp-now" tip="Food is needed to regenerate health automatically after combat." />
    </section>

    <section className="player-hud__row player-hud__storage" title="Build Warehouses to increase storage." data-tip-title="Storage" data-tip-body={vm.storageText + ". Wood, stone, planks, and food share this cap. Coins are separate."}>
      <b>Shared storage</b><span>{vm.storageUsed}/{vm.storageLimit || "?"}</span><em>{vm.storageFree} free</em>
    </section>

    <section className="player-hud__resources" aria-label="Resources">
      <ResourcePill icon="🪵" label="Wood" value={vm.wood} cap={vm.woodCap} tip="Wood increases by chopping and gathering trees. It shares material storage with stone, planks, and food." />
      <ResourcePill icon="🪨" label="Stone" value={vm.stone} cap={vm.stoneCap} tip="Stone is used for claiming and building. Build Warehouses to expand storage." />
      <ResourcePill icon="🌾" label="Food" value={vm.food} cap={vm.foodCap} tip="Food is used to regenerate health automatically after fights and raids." />
    </section>

    <section className="player-hud__row player-hud__money" title="Coins are separate from resource storage." data-tip-title="Coins and Wonders" data-tip-body="Coins come from pickups, referrals, markets, and Keep raids. World Wonders are the long-term landmark goal.">
      <b>🪙 Coins</b><span>{vm.gold}</span><em>Wonders {vm.wondersBuilt}</em>
    </section>

    {vm.hint.lead ? <footer className="player-hud__notice"><b>{vm.hint.lead}</b>{vm.hint.rest ? <span>{vm.hint.rest}</span> : null}</footer> : null}
    {vm.spectator ? <footer className="player-hud__notice"><b>Spectator</b><span>Read-only world view.</span></footer> : null}
  </aside>;
}