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
  return <div className="ui31-resource" aria-label={`${label}: ${value} of ${cap}`} data-tip-title={label} data-tip-body={tip}>
    <span>{icon}</span><b>{value}</b>
  </div>;
}

export function PlayerHudView(props: any) {
  const {
    player,
    liveEnergy = 0,
    maxHp = 100,
    xpNeeded = 1,
    visiblePlayers = 0,
    activePlayers = visiblePlayers,
    gameplayHint = "",
  } = props;

  const m = player || {};
  const vm = playerHudViewModel({ player: m, liveEnergy, maxHp, xpNeeded, visiblePlayers, activePlayers, gameplayHint });
  const primaryWarning = vm.limitRows?.[0] || null;

  return <aside className="scv-hud ui31-hud" aria-label="Player status">
    <header className="ui31-hud-head">
      <div className="ui31-avatar" aria-label={`Level ${vm.level}`} style={{ ["--xp" as any]: `${vm.xpPct.toFixed(0)}%` }}><b>{vm.level}</b></div>
      <div className="ui31-hud-title">
        <h1>{vm.name}</h1>
        <p><span>🪙 {vm.gold}</span><span>{vm.territory}/{vm.tileCap} tiles{vm.reputationTileBonus ? ` (+${vm.reputationTileBonus} rep)` : ""}</span><span>{vm.storageUsed}/{vm.storageLimit} storage</span></p>
        <p className="ui31-factions" aria-label="Reputation"><span title={vm.reputationTitle}>★ {vm.reputation}</span><span>{vm.reputationTitle}</span></p>
      </div>
    </header>

    <section className="ui31-vitals" aria-label="Vitals">
      <Meter
        kind="energy"
        icon="⚡"
        label="Energy"
        now={vm.energyNow}
        max={vm.maxEnergy}
        pct={vm.energyPct}
        fillId="sc-e-fill"
        valueId="sc-e-now"
        tip={`Energy ${vm.energyNow} / ${vm.maxEnergy}. Movement stays free; energy limits gathering, claiming, building, and attacks.`}
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

    <section className="ui31-resources" aria-label="Resources">
      <ResourceChip icon="🪵" label="Wood" value={m.inv?.w || 0} cap={m.storageCap?.w || 250} tip={`Wood ${m.inv?.w || 0}. Storage cap: ${m.storageCap?.w || 250}.`} />
      <ResourceChip icon="🪨" label="Stone" value={m.inv?.s || 0} cap={m.storageCap?.s || 250} tip={`Stone ${m.inv?.s || 0}. Storage cap: ${m.storageCap?.s || 250}.`} />
      <ResourceChip icon="🌾" label="Food" value={m.inv?.f || 0} cap={m.storageCap?.f || 250} tip={`Food ${m.inv?.f || 0}. Farms spawn crops; gather food for recovery.`} />
      <ResourceChip icon="🪙" label="Coins" value={m.inv?.g || 0} cap={m.storageCap?.g || 999999} tip={`Coins ${m.inv?.g || 0}. Earn coins from territory, markets, and Keep raids.`} />
    </section>

    {primaryWarning ? <section className={`ui31-hud-note ${primaryWarning.cls || "warn"}`} data-tip-title={primaryWarning.title} data-tip-body={primaryWarning.body}>
      <span>{primaryWarning.glyph}</span><b>{primaryWarning.short}</b>
    </section> : null}

    <div className="ui31-avatar-ring" aria-label={`XP ${vm.xp} / ${vm.xpNeeded}`} style={{ ["--xp" as any]: `${vm.xpPct.toFixed(0)}%` }} />

    {vm.hintLead ? <footer className="ui31-hud-hint"><span>{vm.hintLead}</span>{vm.hintRest ? <em>{vm.hintRest}</em> : null}</footer> : null}
    {vm.spectator ? <footer className="ui31-hud-hint"><span>Spectator</span><em>Read-only world view.</em></footer> : null}
  </aside>;
}