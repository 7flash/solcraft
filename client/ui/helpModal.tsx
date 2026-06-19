// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function HelpModalView() {
  return <div className="modal" style={{ width: "min(560px,94vw)" }}>
    <h2>How to play</h2>
    <p className="tiny">Use the bottom bar like a city-builder hotbar: craft, gather with separate tools, capture, build, deploy crafted tools, and interact. Movement works in every action mode by clicking the world or using WASD, and each tile costs a tiny bit of energy that refills quickly. Tutorial objectives live in Quests.</p>
    <p><span className="kbd">1</span> craft · <span className="kbd">2</span> wood · <span className="kbd">3</span> stone · <span className="kbd">4</span> capture · <span className="kbd">5</span> build · <span className="kbd">6</span> deploy · <span className="kbd">7</span> use/scroll</p>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      <div className="card"><div className="card-title">Gather</div><div className="tiny">Select Wood or Stone, then click the matching highlighted resource. Drops become pickups on the ground instead of teleporting into your bag.</div></div>
      <div className="card"><div className="card-title">Build</div><div className="tiny">Press 5, scroll the row, read exact cost/purpose, then click a valid owned pad.</div></div>
      <div className="card"><div className="card-title">Coin Economy Goal</div><div className="tiny">Claim more territory to increase coin opportunities, tax visitors on your land, and defend your Coin Mint.</div></div>
      <div className="card"><div className="card-title">Redeem</div><div className="tiny">Your Phantom wallet is the account and payout wallet.</div></div>
    </div>
  </div>;
}
