// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { MAX_LEVEL, lvlMul, repairCost, upgradeCost } from "../../game/shared";
import { inspectPanelViewModel, rgba, safeHex } from "./inspectPanelModel";

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
  } = props;

  const vm = inspectPanelViewModel({ building: b, player, def, inspectUid, inspectDraft, faceImage });
  const level = vm.level;
  const maxLvl = level >= MAX_LEVEL;
  const upCost = maxLvl ? {} : upgradeCost(def, level);
  const missingHp = (b.maxHp || 0) - (b.hp || 0);
  const repCost = repairCost(missingHp);
  const costText = typeof costStr === "function" ? costStr : (cost: any) => Object.entries(cost || {}).map(([k, v]) => `${v}${k}`).join(" ");

  return (
    <div className="utility-pop inspect-pop" data-stop-pointerdown="1" style={{ borderColor: vm.accentLine, boxShadow: `0 18px 48px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.05), 0 0 0 3px ${rgba(vm.accent, 0.08)}` }}>
      <button className="utility-close" data-click="inspect-close">×</button>
      <div className="mini3d-preview object-preview-stage building-preview-stage" data-mini3d-preview="1" data-preview-kind="building" data-building-kind={b.kind} data-preview-accent={vm.accent} aria-label={`${b.nm || def?.name || b.kind} 3D preview`}><span>{def?.glyph || "▣"}</span></div>
      <div className="inspect-head">
        <span className="accent-orb" style={{ background: vm.accent, boxShadow: `0 0 0 3px ${vm.accentSoft}, 0 0 18px ${rgba(vm.accent, 0.24)}` }} />
        <div className="inspect-name">{def?.glyph} {b.nm || def?.name}</div>
        <span className="stat">Lv {level}</span>
      </div>
      <div className="owner-card" style={{ borderColor: rgba(vm.accent, 0.26), background: `linear-gradient(135deg, ${rgba(vm.accent, 0.13)}, rgba(255,255,255,.045))` }}>
        {vm.face ? <img className="face-preview small" src={vm.face} /> : <div className="face-preview small empty" />}
        <div>
          <div className="card-title">{vm.mine ? "Your building" : `${b.ownerName}'s building`}</div>
          <div className="tiny">{def?.blurb || "City structure"}</div>
        </div>
      </div>
      <div className="row" style={{ margin: "8px 0", gap: 8 }}>
        <span className="tiny">HP {Math.ceil(b.hp)}/{b.maxHp}</span>
        <span className="hpbar"><i style={{ width: `${(vm.hpPct * 100).toFixed(0)}%` }} /></span>
      </div>
      {construction ? <div className="recipe-req">
        <b>Construction:</b> {Math.max(1, Math.round(construction.progress * 100))}% · about {Math.ceil(construction.left / 1000)}s left
        <span className="hpbar" style={{ marginTop: 6 }}><i style={{ width: `${Math.max(1, construction.progress * 100).toFixed(0)}%` }} /></span>
      </div> : null}
      {b.kind === "worldwonder" ? <div className="recipe-req"><b>District:</b> roads connect nearby settlements to this Wonder. Open View 3D to inspect the finished monument.</div> : null}
      {vm.mine ? <div>
        <div className="utility-field"><label>Building name</label><div className="utility-row">
          <input id="sc-rename" maxLength={16} placeholder={def?.name} defaultValue={b.nm || ""} style={{ flex: 1 }} />
          <button className="btn" data-click="inspect-rename">Rename</button>
        </div></div>
        <div className="utility-field"><label>Building color combinations</label>
          <div className="combo-grid building-combos">
            {buildingColorPresets.map((preset: any) => {
              const p1 = preset.primary ? safeHex(preset.primary) : vm.defaultAccent;
              const p2 = safeHex(preset.secondary || p1);
              const on = preset.primary ? safeHex(vm.liveCl || "") === p1 : !vm.liveCl;
              return <button type="button" aria-pressed={on} className={"combo-card" + (on ? " on" : "")} style={{ "--p1": p1, "--p2": p2, "--choice-glow": rgba(p2, 0.30) }} aria-label={`${preset.name} building colors`} data-inspect-preset-id={preset.id}>
                {on ? <span className="combo-check">✓</span> : null}
                <b>{preset.name}</b>
                <span className="combo-dots"><i className="combo-dot" style={{ background: p1 }} /><i className="combo-dot" style={{ background: p2 }} /></span>
              </button>;
            })}
          </div>
          <div className="tiny" style={{ marginTop: 6 }}>Selected: <b style={{ color: vm.accent }}>{vm.accentLabel}</b>{vm.hasDraftColor ? <span> · saving…</span> : null}. Themes apply a safe accent and matching trim.</div>
        </div>
      </div> : null}
      <div className="utility-row tiny" style={{ margin: "8px 0" }}>
        <span className="stat">+{(def?.regen * lvlMul(level)).toFixed(2)}/s</span>
        {def?.maxE ? <span className="stat">+{def.maxE} cap</span> : null}
        {def?.prod ? <span className="stat">bin {Math.floor(estimatedBin)}/60</span> : null}
        {vm.cdLeft ? <span className="stat">⏳ {vm.cdLeft}s</span> : null}
      </div>
      {territoryHint ? <div className="tiny" style={{ margin: "0 0 8px", color: "#d8cfb7" }}><b>Upgrade bonus:</b> {String(territoryHint).replace(/^Upgrade effect: /, "")}</div> : null}
      <div className="inspect-actions">
        {b.kind === "worldwonder" ? <button className="btn primary" data-click="inspect-wonder-view">View 3D</button> : <button className="btn primary" data-click="inspect-use">Use</button>}
        {b.kind === "worldwonder" ? <button className="btn" data-click="inspect-walk-near">Walk near</button> : null}
        {vm.mine && b.kind !== "worldwonder" ? <button className="btn" disabled={maxLvl} data-click="inspect-upgrade">{maxLvl ? "Max level" : `Upgrade (${costText(upCost)})`}</button> : null}
        {vm.mine ? <button className="btn" disabled={missingHp <= 0} data-click="inspect-repair">{missingHp <= 0 ? "Full HP" : `Repair (${costText(repCost)})`}</button> : null}
        {vm.mine ? <button className="btn danger" data-click="inspect-demolish">Demolish</button> : null}
        {!vm.mine && (b.kind === "keep" || b.kind === "bomb") ? <button className="btn danger" data-click="inspect-raid">Raid</button> : null}
        {!vm.mine && b.kind !== "worldwonder" ? <button className="btn" data-click="inspect-walk-near">Walk closer</button> : null}
      </div>
    </div>
  );
}
