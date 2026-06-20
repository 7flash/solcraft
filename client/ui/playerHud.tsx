// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { playerHudViewModel } from "./playerHudModel";

function FallbackIcon({ fallback = "•" }: any) {
  return <span className="ui-ico"><span>{fallback}</span></span>;
}

function Meter({ kind, icon, label, now, max, pct, fillId, valueId, tip }: any) {
  return <div className={`ui30-meter ui30-meter-${kind}`} data-tip-title={label} data-tip-body={tip}>
    <div className="ui30-meter-meta"><span>{icon}</span><b>{label}</b></div>
    <div className="ui30-meter-track"><i id={fillId} style={{ width: `${Number(pct || 0).toFixed(1)}%` }} /></div>
    <div className="ui30-meter-value"><span id={valueId}>{now}</span><span>/</span><b>{max}</b></div>
  </div>;
}

function ResourceChip({ icon, label, value, cap, tip }: any) {
  return <div className="ui30-resource-chip" aria-label={`${label}: ${value} of ${cap}`} data-tip-title={label} data-tip-body={tip}>
    <span className="ui30-resource-icon">{icon}</span>
    <b>{value}</b>
  </div>;
}

export function PlayerHudView(props: any) {
  const {
    player,
    panel = "",
    liveEnergy = 0,
    maxHp = 100,
    xpNeeded = 1,
    visiblePlayers = 0,
    activePlayers = visiblePlayers,
    gameplayHint = "",
    Icon = FallbackIcon,
  } = props;

  const m = player || {};
  const vm = playerHudViewModel({ player: m, liveEnergy, maxHp, xpNeeded, visiblePlayers, activePlayers, gameplayHint });

  return <aside className="scv-hud ui2-player-hud ui30-card ui30-player-hud" aria-label="Player status">
    <header className="ui30-player-top">
      <div className="ui30-avatar"><b>{vm.initial}</b><span>{vm.level}</span></div>
      <div className="ui30-player-title">
        <h1>{vm.name}</h1>
        <p><span>🪙 {vm.gold}</span><span>🔬 {vm.science}/{vm.scienceCap}</span><span>{vm.territory}/{vm.tileCap} tiles</span><span>{vm.built} builds</span></p>
      </div>
    </header>

    <section className="ui30-meter-stack" aria-label="Vitals">
      <Meter
        kind="energy"
        icon="⚡"
        label="Energy"
        now={vm.energyNow}
        max={vm.maxEnergy}
        pct={vm.energyPct}
        fillId="sc-e-fill"
        valueId="sc-e-now"
        tip={`Energy ${vm.energyNow} / ${vm.maxEnergy}. Movement and world actions spend energy; it refills over time.`}
      />
      <Meter
        kind="health"
        icon="♥"
        label="Health"
        now={vm.hpNow}
        max={vm.maxHp}
        pct={vm.hpPct}
        fillId="sc-hp-fill"
        valueId="sc-hp-now"
        tip={`Health ${vm.hpNow} / ${vm.maxHp}. Food helps you recover after dangerous encounters.`}
      />
    </section>

    <section className="ui30-resource-grid" aria-label="Resources">
      <ResourceChip icon="🪵" label="Wood" value={m.inv?.w || 0} cap={m.storageCap?.w || 250} tip={`Wood ${m.inv?.w || 0}. Storage cap: ${m.storageCap?.w || 250}.`} />
      <ResourceChip icon="🪨" label="Stone" value={m.inv?.s || 0} cap={m.storageCap?.s || 250} tip={`Stone ${m.inv?.s || 0}. Storage cap: ${m.storageCap?.s || 250}.`} />
      <ResourceChip icon="🌾" label="Food" value={m.inv?.f || 0} cap={m.storageCap?.f || 250} tip={`Food ${m.inv?.f || 0}. Farms and crops provide food for recovery.`} />
      <ResourceChip icon="◈" label="Shards" value={m.inv?.sh || 0} cap={m.storageCap?.sh || 250} tip={`Shards ${m.inv?.sh || 0}. Storage cap: ${m.storageCap?.sh || 250}.`} />
    </section>

    <section className="ui30-alert-card" data-tip-title="Settlement limits" data-tip-body={vm.limitSummary}>
      <b>Limits</b>
      <span>{vm.territory}/{vm.tileCap} tiles · {vm.built} buildings</span>
    </section>

    {vm.limitRows.length ? <section className="ui30-warning-row" aria-label="Warnings">
      {vm.limitRows.slice(0, 2).map((r: any) => <div className={`ui30-warning-pill ${r.cls || "warn"}`} data-tip-title={r.title} data-tip-body={r.body}><span>{r.glyph}</span><b>{r.short}</b></div>)}
    </section> : null}

    <div className="ui30-xp" aria-label={`XP ${vm.xp} / ${vm.xpNeeded}`} data-tip-title="Level progress" data-tip-body={`XP ${vm.xp} / ${vm.xpNeeded}.`}><i style={{ width: `${vm.xpPct.toFixed(0)}%` }} /></div>

    <footer className="ui30-hint"><b>{vm.hintLead}</b>{vm.hintRest ? <span>{vm.hintRest}</span> : null}</footer>
    {vm.spectator ? <footer className="ui30-hint"><b>Spectator</b><span>Read-only world view.</span></footer> : null}
  </aside>;
}
