// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { MAX_LEVEL, lvlMul, repairCost, upgradeCost } from "@server/shared";
import { FOUNDATION_KIND, FOUNDATION_BUILD_KINDS, foundationChoiceLabel } from "@server/foundationRules";
import { inspectPanelViewModel, rgba, safeHex } from "./inspectPanelModel";
import { keepPressureModel } from "./keepPressure";

function costTextFallback(cost: any) {
  return Object.entries(cost || {}).map(([k, v]) => `${v}${k}`).join(" ");
}

function StatRow({ label, value, accent = false }: any) {
  return <div className={"inspect-stat-row" + (accent ? " accent" : "")}><span>{label}</span><b>{value}</b></div>;
}

export function InspectPanelView(props: any) {
  const {
    building: b,
    player,
    def,
    inspectUid,
    inspectDraft,
    faceImage,
    buildingColorPresets = [],
    construction,
    territoryHint = "",
    estimatedBin = 0,
    costStr,
    foundationChoices = [],
    bank = null,
  } = props;

  const vm = inspectPanelViewModel({ building: b, player, def, inspectUid, inspectDraft, faceImage });
  const isFoundation = String(b.kind || "") === "foundation";
  const finalChoices = Array.isArray(foundationChoices) ? foundationChoices : [];
  const isBank = String(b.kind || "") === "vault";
  const isCustomizer = String(b.kind || "") === "alchemy";
  const tokenLabel = bank?.config?.tokenLabel || "$CRAFTS";
  const inGameCoins = bank?.bankTokens?.amountUi ?? String(Math.floor(Number(player?.inv?.g || 0)));
  const walletCoins = bank?.walletBalance?.amountUi || bank?.walletBalanceApproxUi || String(player?.tokenBalance || 0);
  const walletText = player?.wallet ? String(player.wallet).slice(0, 4) + "…" + String(player.wallet).slice(-4) : "not connected";
  const customizerCost = Math.max(0, Number(bank?.customizerCost || 1) || 1);
  const level = vm.level;
  const maxLvl = level >= MAX_LEVEL;
  const upCost = maxLvl ? {} : upgradeCost(def, level);
  const missingHp = (b.maxHp || 0) - (b.hp || 0);
  const repCost = repairCost(missingHp);
  const formatCost = typeof costStr === "function" ? costStr : costTextFallback;
  const hpText = `${Math.ceil(b.hp || 0)} / ${Math.ceil(b.maxHp || 0)}`;
  const ownerText = vm.mine ? "Your building" : `${b.ownerName || "Someone"}'s building`;
  const keepPressure = Number(b.owner || 0) === 0 && b.kind === "keep" ? keepPressureModel({ hp: b.hp, maxHp: b.maxHp, stored: b.stored, accAt: b.accAt, now: Date.now(), playerHp: player?.hp, siegeBonus: player?.siegeBonus || 0 }) : null;

  return <aside className="utility-pop inspect-pop panel-card inspect-panel" data-stop-pointerdown="1" style={{ "--inspect-accent": vm.accent, "--inspect-accent-soft": rgba(vm.accent, 0.13), "--inspect-accent-line": rgba(vm.accent, 0.42) }}>
    <button className="utility-close inspect-close" data-click="inspect-close" aria-label="Close inspect panel">×</button>

    <section className="inspect-preview">
      <div className="mini3d-preview object-preview-stage building-preview-stage inspect-preview-stage" data-mini3d-preview="1" data-preview-kind="building" data-building-kind={b.kind} data-preview-accent={vm.accent} aria-label={`${b.nm || def?.name || b.kind} 3D preview`}><span>{def?.glyph || "▣"}</span></div>
    </section>

    <header className="inspect-header">
      <div className="inspect-title-mark" aria-hidden="true">{def?.glyph || "▣"}</div>
      <div>
        <p>{ownerText}</p>
        <h2>{b.nm || def?.name || b.kind}</h2>
      </div>
      <span className="inspect-level-badge">Lv {level}</span>
    </header>

    <section className="inspect-summary">
      <p>{isFoundation ? "This construction pad is ready for a building." : (def?.blurb || "A settlement structure.")}</p>
    </section>

    <section className="inspect-stat-list" aria-label="Building stats">
      <StatRow label="Health" value={hpText} accent />
      <div className="inspect-health-track"><i style={{ width: `${(vm.hpPct * 100).toFixed(0)}%` }} /></div>
      {construction ? <>
        <StatRow label="Construction" value={`${Math.max(1, Math.round(construction.progress * 100))}% · ${Math.ceil(construction.left / 1000)}s`} />
        <div className="inspect-progress-track"><i style={{ width: `${Math.max(1, construction.progress * 100).toFixed(0)}%` }} /></div>
      </> : null}
      {!isFoundation && ["lumber", "quarry", "farm"].includes(String(b.kind || "")) ? <StatRow label="Role" value="creates nearby resources" /> : null}
      {def?.maxE ? <StatRow label="Energy cap" value={`+${def.maxE}`} /> : null}
      {def?.prod ? <StatRow label="Stored cycle" value={`${Math.floor(estimatedBin)}/60`} /> : null}
      {vm.cdLeft ? <StatRow label="Cooldown" value={`${vm.cdLeft}s`} /> : null}
    </section>

    {territoryHint ? <section className="inspect-note"><b>Upgrade bonus</b><span>{String(territoryHint).replace(/^Upgrade effect: /, "")}</span></section> : null}
    {b.kind === "worldwonder" ? <section className="inspect-note"><b>District anchor</b><span>This landmark connects nearby settlements and city bonuses.</span></section> : null}
    {keepPressure ? <section className={`keep-raid-card ${keepPressure.pressure}`} aria-label="Keep raid pressure">
      <div className="keep-raid-header"><div><b>Raid pressure</b><span>{keepPressure.pressureLabel}</span></div><strong>{keepPressure.hpLabel}</strong></div>
      <div className="keep-raid-track"><i style={{ width: `${Math.max(2, keepPressure.hpPct * 100).toFixed(0)}%` }} /></div>
      <div className="keep-raid-grid">
        <span><b>{keepPressure.regenLabel}</b><em>{keepPressure.nextRegenLabel}</em></span>
        <span><b>{keepPressure.hitsLabel}</b><em>if the group keeps pressure</em></span>
        <span><b>{keepPressure.coinChipLabel}</b><em>{keepPressure.storedLabel}</em></span>
        <span><b>{keepPressure.raidHealthLabel}</b><em>Food restores health over time</em></span>
      </div>
    </section> : null}

    {isBank ? <section className="service-card bank" aria-label="Bank building actions">
      <div className="panel-section-head"><b>Bank service</b><span>{walletText}</span></div>
      <div className="bank-balance-grid">
        <span><small>In game</small><b>{inGameCoins}</b><em>{tokenLabel}</em></span>
        <span><small>Wallet</small><b>{walletCoins}</b><em>{tokenLabel}</em></span>
      </div>
      <div className="service-action-row">
        <button className="panel-button primary" data-click="inspect-bank-open">Open bank</button>
        <button className="panel-button" disabled data-click="inspect-bank-deposit-disabled">Deposit</button>
        <button className="panel-button" disabled data-click="inspect-bank-withdraw-disabled">Withdraw</button>
      </div>
      <p className="panel-muted">Deposit and Withdraw stay inside the bank screen so wallet, amount, and pending status are visible before signing.</p>
    </section> : null}

    {isCustomizer ? <section className="service-card tailor" aria-label="Character customizer actions">
      <div className="panel-section-head"><b>Customizer</b><span>{customizerCost}🪙 access</span></div>
      <p className="panel-muted">Change body, clothes, and hat from this building. Your character keeps the same identity while you change outfit colors and gear.</p>
      <button className="panel-button primary" data-click="inspect-customizer-open">Customize character</button>
    </section> : null}


    {isFoundation && vm.mine ? <section className="foundation-card" aria-label="Choose foundation building">
      <div className="panel-section-head"><b>Choose building</b><span>One foundation becomes one structure.</span></div>
      <div className="foundation-grid">
        {finalChoices.map((choice: any) => <button className="foundation-choice" data-click="foundation-build" data-id={choice.id}>
          <strong>{choice.name || foundationChoiceLabel(choice.id)}</strong>
          <span>{choice.blurb || "Start construction on this pad."}</span>
          <em>{formatCost(choice.cost || {}) || "Free"}</em>
        </button>)}
      </div>
    </section> : null}

    <section className="inspect-actions" aria-label="Building actions">
      {!isFoundation && !isBank && !isCustomizer && (b.kind === "worldwonder" ? <button className="panel-button primary" data-click="inspect-wonder-view">View 3D</button> : <button className="panel-button primary" data-click="inspect-use">Use</button>)}
      {!isFoundation ? <button className="panel-button" data-click="inspect-share">{b.kind === "keep" ? "Rally group" : "Share in chat"}</button> : null}
      {b.kind === "worldwonder" ? <button className="panel-button" data-click="inspect-walk-near">Walk near</button> : null}
      {vm.mine && !isFoundation && b.kind !== "worldwonder" ? <button className="panel-button" disabled={maxLvl} data-click="inspect-upgrade">{maxLvl ? "Max level" : `Upgrade · ${formatCost(upCost)}`}</button> : null}
      {vm.mine && !isFoundation ? <button className="panel-button" disabled={missingHp <= 0} data-click="inspect-repair">{missingHp <= 0 ? "Full health" : `Repair · ${formatCost(repCost)}`}</button> : null}
      {!vm.mine && b.kind === "keep" ? <button className="panel-button keep-tribute" data-click="inspect-donate-keep">Donate 10🪙</button> : null}
      {!vm.mine && (b.kind === "keep" || b.kind === "bomb") ? <button className="panel-button danger" disabled={!!keepPressure && !keepPressure.canRaid} data-click="inspect-raid">{keepPressure && !keepPressure.canRaid ? "Recover first" : "Raid"}</button> : null}
      {!vm.mine && b.kind !== "worldwonder" ? <button className="panel-button" data-click="inspect-walk-near">Walk closer</button> : null}
      {vm.mine ? <button className="panel-button danger" data-click="inspect-demolish">{isFoundation ? "Remove foundation" : "Demolish"}</button> : null}
    </section>

    {vm.mine && !isFoundation ? <details className="panel-details">
      <summary>Customize</summary>
      <div className="panel-field"><label>Building name</label><div className="panel-inline">
        <input id="sc-rename" maxLength={16} placeholder={def?.name} defaultValue={b.nm || ""} />
        <button className="panel-button small" data-click="inspect-rename">Rename</button>
      </div></div>
      <div className="panel-field"><label>Color palette</label>
        <div className="color-palette-grid">
          {buildingColorPresets.map((preset: any) => {
            const p1 = preset.primary ? safeHex(preset.primary) : vm.defaultAccent;
            const p2 = safeHex(preset.secondary || p1);
            const on = preset.primary ? safeHex(vm.liveCl || "") === p1 : !vm.liveCl;
            return <button type="button" aria-pressed={on} className={"color-palette-button" + (on ? " on" : "")} style={{ "--p1": p1, "--p2": p2 }} aria-label={`${preset.name} building colors`} data-inspect-preset-id={preset.id}>
              <b>{preset.name}</b><span><i style={{ background: p1 }} /><i style={{ background: p2 }} /></span>{on ? <em>✓</em> : null}
            </button>;
          })}
        </div>
        <p className="panel-muted">Selected <b style={{ color: vm.accent }}>{vm.accentLabel}</b>{vm.hasDraftColor ? " · saving…" : ""}</p>
      </div>
    </details> : null}
  </aside>;
}