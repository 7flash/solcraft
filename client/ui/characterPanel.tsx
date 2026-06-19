// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { characterPanelViewModel } from "./characterPanelModel";

export function CharacterPanelView(props: any) {
  const { profile, presets = [], rgba = (value: string, alpha: number) => value } = props;
  const vm = characterPanelViewModel({ profile, presets });

  return <>
    <div className="utility-field"><label>Body parts</label>
      <div className="char-part-list">
        {vm.partRows.map((row) => <div className="char-part-row">
          <button type="button" className="mini" data-char-part-step="1" data-key={row.key} data-delta="-1" aria-label={`Previous ${row.label}`}>−</button>
          <div className="char-part-mid">
            <div><b>{row.label}</b><span>{row.hint}</span></div>
            <input type="range" min="0" max="7" value={row.value} data-input="char-part" data-key={row.key} aria-label={row.label} />
          </div>
          <button type="button" className="mini" data-char-part-step="1" data-key={row.key} data-delta="1" aria-label={`Next ${row.label}`}>+</button>
          <strong>{row.value}</strong>
        </div>)}
      </div>
    </div>
    <div className="utility-field"><label>Color combos</label>
      <div className="combo-grid character-combos">
        {vm.presetCards.map((card) => {
          const preset = card.preset;
          return <button type="button" className={"combo-card" + (card.active ? " on" : "")} data-char-preset-id={preset.id} aria-pressed={card.active} aria-label={`${preset.name} colors`} style={{ "--p1": card.primaryCloth, "--p2": card.secondaryCloth, "--choice-glow": rgba(card.secondaryCloth, 0.28) }}>
            {card.active ? <span className="combo-check">✓</span> : null}
            <b>{preset.name}</b>
            <small className="combo-look">Colors</small>
            <span className="combo-dots"><i className="combo-dot" style={{ background: card.skin }} /><i className="combo-dot" style={{ background: card.primaryCloth }} /><i className="combo-dot" style={{ background: card.secondaryCloth }} /><i className="combo-dot" style={{ background: card.leather }} /><i className="combo-dot" style={{ background: card.metal }} /></span>
          </button>;
        })}
      </div>
    </div>
  </>;
}
