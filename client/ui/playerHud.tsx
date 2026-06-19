// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { playerHudViewModel } from "./playerHudModel";

function FallbackIcon({ fallback = "•" }: any) {
  return <span className="ui-ico"><span>{fallback}</span></span>;
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

  return (
    <div className="scv-hud ui2-player-hud">
      <div className="scv-top ui2-player-head">
        <div className="scv-av ui2-player-avatar"><b>{vm.initial}</b><span className="scv-lv">{vm.level}</span></div>
        <div className="scv-id ui2-player-id">
          <div className="scv-name">{vm.name}</div>
          <div className="scv-sub">
            <span className="scv-gold">🪙 {vm.gold}</span>
            <span className="scv-gold">🔬 {vm.science}/{vm.scienceCap}</span>
            <small>· {vm.territory}/{vm.tileCap} tiles · {vm.built} builds · {vm.visiblePlayers}/{vm.activePlayers} players visible</small>
          </div>
        </div>
      </div>

      <div className="scv-meters ui2-player-meters">
        <div className="scv-meter" data-tip-title="Energy" data-tip-body={`Current energy ${vm.energyNow} / ${vm.maxEnergy}. Claiming, moving, building, chopping, and mining spend energy; it refills over time.`}>
          <span className="ic">⚡</span>
          <div className="scv-track e"><i id="sc-e-fill" style={{ width: `${vm.energyPct.toFixed(1)}%` }} /></div>
          <span className="scv-val"><span id="sc-e-now">{vm.energyNow}</span> / {vm.maxEnergy}</span>
        </div>
        <div className="scv-meter" data-tip-title="Health" data-tip-body={`Current health ${vm.hpNow} / ${vm.maxHp}. Siege tools target territory and structures; keep your city defended.`}>
          <span className="ic">♥</span>
          <div className="scv-track hp"><i id="sc-hp-fill" style={{ width: `${vm.hpPct.toFixed(1)}%` }} /></div>
          <span className="scv-val"><span id="sc-hp-now">{vm.hpNow}</span> / {vm.maxHp}</span>
        </div>
      </div>

      <div className="scv-res ui2-player-resources">
        <div className="scv-pill" aria-label={`Wood storage cap ${m.storageCap?.w || 250}`} data-tip-title="Wood" data-tip-body={`You have ${m.inv?.w || 0} wood. Storage cap: ${m.storageCap?.w || 250}. Build Warehouses to raise wood/stone/plank/shard caps.`}><span className="pi">🪵</span><b>{m.inv?.w || 0}</b></div>
        <div className="scv-pill" aria-label={`Stone storage cap ${m.storageCap?.s || 250}`} data-tip-title="Stone" data-tip-body={`You have ${m.inv?.s || 0} stone. Storage cap: ${m.storageCap?.s || 250}. Mine rocks or use Quarry buildings for more.`}><span className="pi">🪨</span><b>{m.inv?.s || 0}</b></div>
        <div className="scv-pill" aria-label={`Food cap ${m.storageCap?.f || 250}`} data-tip-title="Food" data-tip-body={`You have ${m.inv?.f || 0} food. Food cap: ${m.storageCap?.f || 250}. Farms produce food; Granaries raise food capacity.`}><span className="pi">🌾</span><b>{m.inv?.f || 0}</b></div>
        <div className="scv-pill" aria-label={`Shard cap ${m.storageCap?.sh || 250}`} data-tip-title="Shards" data-tip-body={`You have ${m.inv?.sh || 0} shards. Storage cap: ${m.storageCap?.sh || 250}. Shards are used for advanced buildings and deployed tools.`}><span className="pi">◈</span><b>{m.inv?.sh || 0}</b></div>
      </div>

      <div className="scv-cap ui2-player-cap" data-tip-title="Tile and resource limits" data-tip-body={vm.limitSummary}>
        <b>Limits</b> Tiles {vm.territory}/{vm.tileCap} · build Warehouses/Granaries for storage; Town Hall/World Wonder for territory.
      </div>

      {vm.limitRows.length ? <div className="scv-limit-row ui2-limit-row">
        {vm.limitRows.map((r: any) => <div className={`scv-limit-pill ${r.cls || "warn"}`} data-tip-title={r.title} data-tip-body={r.body}><span>{r.glyph}</span><b>{r.short}</b></div>)}
      </div> : null}

      <div className="scv-xp ui2-player-xp" aria-label={`XP ${vm.xp} / ${vm.xpNeeded}`} data-tip-title="Level progress" data-tip-body={`XP ${vm.xp} / ${vm.xpNeeded}. Gathering, claiming, building, crafting, and guide rewards all add XP.`}>
        <i style={{ width: `${vm.xpPct.toFixed(0)}%` }} />
      </div>

      <div className="scv-tabs ui2-player-tabs">
        <button className={"scv-tab" + (panel === "char" ? " on" : "")} data-click="toggle-panel" data-panel="char" data-guide-target="char" data-tip-title="Character" data-tip-body="Customize your settler while staying in the world."><Icon name="character" fallback="C" /><span>Character</span></button>
        <button className={"scv-tab" + (panel === "quests" ? " on" : "")} data-click="toggle-panel" data-panel="quests" data-guide-target="quests" data-tip-title="Guide" data-tip-body="Guide cards, skills, and claimable rewards."><Icon name="quests" fallback="G" /><span>Guide</span></button>
        <button className={"scv-tab" + (panel === "skills" ? " on" : "")} data-click="toggle-panel" data-panel="skills" data-tip-title="Achievements" data-tip-body="Skill tiers and progress."><Icon name="skills" fallback="A" /><span>Achievements</span></button>
        <button className={"scv-tab" + (panel === "more" ? " on" : "")} data-click="open-more" data-panel="more" data-tip-title="More" data-tip-body="Bank, craft, siege, wonders, map, settings, and help."><Icon name="settings" fallback="☰" /><span>More</span></button>
      </div>

      <div className="scv-hint ui2-player-hint"><b>{vm.hintLead}</b>{vm.hintRest ? " — " + vm.hintRest : ""}</div>
      {vm.spectator ? <div className="scv-hint ui2-player-hint"><b>Spectator</b> — ghost view; read-only and no coin pickups</div> : null}
    </div>
  );
}
