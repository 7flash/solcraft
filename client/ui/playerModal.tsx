// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { playerModalViewModel } from "./playerModalModel";

export function PlayerModalView(props: any) {
  const { target, player, worldPlayer } = props;
  if (!target) return <div />;
  const vm = playerModalViewModel({ target, player, worldPlayer });
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
        <span className="stat">⚔ Weak PvP</span>
        {vm.adjacent ? <span className="stat good">nearby</span> : null}
      </div>
      <p className="tiny">Equipment and skill stats are disabled for this clean ECS release. Player attacks are intentionally weak until the stats system returns.</p>
      <div className="row ui2-player-modal-actions">
        <button className="btn" data-click="player-walk">Walk toward</button>
        <button className="btn" data-click="player-close">Close</button>
      </div>
    </div>
  );
}
