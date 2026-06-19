// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { GEAR_BY_ID, SLOTS, SLOT_LABEL } from "../../game/shared";
import { equippedGearRows, playerModalViewModel } from "./playerModalModel";

export function PlayerModalView(props: any) {
  const { target, player, worldPlayer } = props;
  if (!target) return <div />;
  const vm = playerModalViewModel({ target, player, worldPlayer, gearById: GEAR_BY_ID });
  const rows = equippedGearRows(target, SLOTS, SLOT_LABEL, GEAR_BY_ID);
  return (
    <div className="modal ui2-player-modal">
      <h2 className="ui2-player-modal-title">
        <span className="ui2-player-color-dot" style={{ background: vm.bodyHex }} />
        <span>{vm.name}</span>
        <span className="lvlchip">Lv {vm.level}</span>
        {vm.spectator ? <span className="stat">ghost</span> : null}
      </h2>
      <div className="row ui2-player-modal-stats">
        <span className="stat">♥ {vm.hpNow}/{vm.hpMax}</span>
        <span className="stat">💥 Siege {vm.attack}</span>
        <span className="stat">🛡 Defense {vm.defense}</span>
        {vm.adjacent ? <span className="stat good">nearby</span> : null}
      </div>
      <h3>Worn gear</h3>
      <div className="ui2-player-gear-list">
        {rows.map((row: any) => <div className="slot" data-slot={row.slot}><span><b>{row.label}</b> — {row.empty ? <span className="tiny">—</span> : row.text}</span></div>)}
      </div>
      <div className="row ui2-player-modal-actions">
        <button className="btn" data-click="player-walk">Walk toward</button>
        <button className="btn" data-click="player-close">Close</button>
      </div>
    </div>
  );
}
