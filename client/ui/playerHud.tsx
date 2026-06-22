// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { playerHudViewModel } from "./playerHudModel";

function Meter({ kind, icon, label, now, max, pct, fillId, valueId, tip }: any) {
  return <div className={`ui31-meter ui31-meter-${kind}`} data-tip-title={label} data-tip-body={tip}>
    <div className="ui31-meter-head"><span>{icon}</span><b>{label}</b><em><span id={valueId}>{now}</span> / {max}</em></div>
    <div className="ui31-meter-track"><i id={fillId} style={{ width: `${Number(pct || 0).toFixed(1)}%` }} /></div>
  </div>;
}

function ResourceChip({ icon, label, value, cap, tip }: any) {
  const free = Math.max(0, Number(cap || 0) - Number(value || 0));
  return <div className="ui31-resource" aria-label={`${label}: ${value} of ${cap}`} data-tip-title={label} data-tip-body={tip}>
    <span>{icon}</span><b>{value}</b><em>{free} free</em>
  </div>;
}

export function PlayerHudView(props: any) {
  const { player, liveEnergy = 0, maxHp = 100, xpNeeded = 1, visiblePlayers = 0, activePlayers = visiblePlayers, gameplayHint = "", wondersBuilt = 0 } = props;
  const m = player || {};
  const vm = playerHudViewModel({ player: m, liveEnergy, maxHp, xpNeeded, visiblePlayers, activePlayers, gameplayHint, wondersBuilt });
  const primaryWarning = vm.limitRows?.[0] || null;

  return <aside className="scv-hud ui31-hud ui85-hud" aria-label="Player status">
    <header className="ui31-hud-head ui85-hud-head">
      <div className="ui31-hud-title ui85-hud-title">
        <h1>{vm.name}</h1>
        <p><span>Tiles {vm.territory}/{vm.tileCap || "?"}</span><span>Rep {vm.reputation}</span></p>
      </div>
    </header>

    <section className="ui31-vitals ui85-vitals" aria-label="Vitals">
      <Meter kind="energy" icon="⚡" label="Energy" now={vm.energyNow} max={vm.maxEnergy} pct={vm.energyPct} fillId="sc-e-fill" valueId="sc-e-now" tip={`Energy ${vm.energyNow} / ${vm.maxEnergy}. Energy limits gathering, claiming, building, and attacks.`} />
      <Meter kind="health" icon="♥" label="Health" now={vm.hpNow} max={vm.maxHp} pct={vm.hpPct} fillId="sc-hp-fill" valueId="sc-hp-now" tip={`Health ${vm.hpNow} / ${vm.maxHp}. Food is used for automatic health recovery after combat.`} />
    </section>

    <section className="ui85-storage-row" data-tip-title="Storage" data-tip-body="Wood, stone, and food share storage pressure. Build Warehouses to increase available storage.">
      <b>Storage</b><span>{vm.storageUsed}/{vm.storageLimit || "?"}</span><em>{vm.storageFree} free</em>
    </section>

    <section className="ui31-resources ui85-resources" aria-label="Resources">
      <ResourceChip icon="🪵" label="Wood" value={m.inv?.w || 0} cap={m.storageCap?.w || 0} tip={`Wood ${m.inv?.w || 0}. Build Warehouses to expand storage.`} />
      <ResourceChip icon="🪨" label="Stone" value={m.inv?.s || 0} cap={m.storageCap?.s || 0} tip={`Stone ${m.inv?.s || 0}. Build Warehouses to expand storage.`} />
      <ResourceChip icon="🌾" label="Food" value={m.inv?.f || 0} cap={m.storageCap?.f || 0} tip={`Food ${m.inv?.f || 0}. Food is needed to regenerate health automatically.`} />
    </section>

    <section className="ui85-money-row" aria-label="Coins and Wonders" data-tip-title="Coins" data-tip-body="Coins come from pickups, markets, referral gifts, and Keep raids. World Wonders are long-term coin landmarks.">
      <span>🪙</span><b>{vm.gold}</b><em>Wonders {vm.wondersBuilt}</em>
    </section>

    {primaryWarning ? <section className={`ui31-hud-note ${primaryWarning.cls || "warn"}`} data-tip-title={primaryWarning.title} data-tip-body={primaryWarning.body}>
      <span>{primaryWarning.glyph}</span><b>{primaryWarning.short}</b>
    </section> : null}

    {vm.hintLead ? <footer className="ui31-hud-hint"><span>{vm.hintLead}</span>{vm.hintRest ? <em>{vm.hintRest}</em> : null}</footer> : null}
    {vm.spectator ? <footer className="ui31-hud-hint"><span>Spectator</span><em>Read-only world view.</em></footer> : null}
  </aside>;
}
