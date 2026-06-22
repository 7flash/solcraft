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

function MaterialChip({ icon, label, value }: any) {
  return <span className="player-hud__material-chip"><i>{icon}</i><b>{value}</b><em>{label}</em></span>;
}

function SharedStorageBar({ vm }: any) {
  const wood = `${Math.max(0, Number(vm.woodPct || 0)).toFixed(2)}%`;
  const stone = `${Math.max(0, Number(vm.stonePct || 0)).toFixed(2)}%`;
  const food = `${Math.max(0, Number(vm.foodPct || 0)).toFixed(2)}%`;
  return <section className="player-hud__storage-card" title="Wood, stone, and food share this one storage pool. Warehouses increase it. Coins are separate and unlimited." data-tip-title="Shared storage" data-tip-body={vm.storageText + ". Warehouses are the storage upgrade; coins do not count."}>
    <div className="player-hud__storage-head"><b>Shared storage</b><span>{vm.storageUsed}/{vm.storageLimit || "?"}</span><em>{vm.storageFree} free</em></div>
    <div className="player-hud__storage-track" aria-label="Shared storage segments">
      <i className="wood" style={{ width: wood }} /><i className="stone" style={{ width: stone }} /><i className="food" style={{ width: food }} />
    </div>
    <div className="player-hud__materials" aria-label="Material amounts">
      <MaterialChip icon="🪵" label="wood" value={vm.wood} />
      <MaterialChip icon="🪨" label="stone" value={vm.stone} />
      <MaterialChip icon="🌾" label="food" value={vm.food} />
    </div>
  </section>;
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
      <StatusBar icon="♥" label="Health" now={vm.hpNow} max={vm.maxHp} pct={vm.hpPct} id="sc-hp-now" tip="Food helps health recover after fights and raids." />
    </section>

    <SharedStorageBar vm={vm} />

    <section className="player-hud__row player-hud__money" title="Coins are separate from resource storage and have no cap." data-tip-title="Coins" data-tip-body="Coins have no storage limit. Deposit at the Bank to speed progress, donate for reputation, or spend on World Wonders.">
      <b>🪙 Coins</b><span>{vm.gold}</span><em>no cap · Wonders {vm.wondersBuilt}</em>
    </section>

    {vm.hint.lead ? <footer className="player-hud__notice"><b>{vm.hint.lead}</b>{vm.hint.rest ? <span>{vm.hint.rest}</span> : null}</footer> : null}
    {vm.spectator ? <footer className="player-hud__notice"><b>Spectator</b><span>Read-only world view.</span></footer> : null}
  </aside>;
}
