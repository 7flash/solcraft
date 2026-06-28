// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function OptionsModalView(props: any) {
  const { visual = {}, musicMuted, uiMuted } = props;
  return <div className="modal production-options-modal" style={{ width: "min(720px,94vw)", maxHeight: "90vh", overflow: "auto" }}>
    <div className="modal-title-row">
      <div>
        <p className="settings-kicker">Settings</p>
        <h2>⚙ Options</h2>
      </div>
      <button className="utility-close" data-click="modal-close" aria-label="Close options">×</button>
    </div>
    <p className="tiny">Audio, motion, controls, and session actions are grouped for quick access.</p>
    <div className="settings-tabs sc-settings-tabs"><a href="#options-audio">Audio</a><a href="#options-video">Motion</a><a href="#options-controls">Controls</a></div>
    <div className="grid production-options-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
      <div id="options-audio" className="card"><div className="card-title">Audio</div><div className="tiny">Music and UI sounds are controlled separately.</div><button className="btn primary" data-click="start-music">Start uploaded music</button><button className="btn" data-click="toggle-music">{musicMuted ? "Turn music on" : "Turn music off"}</button><button className="btn" data-click="toggle-ui-sound">{uiMuted ? "Turn UI sound on" : "Turn UI sound off"}</button></div>
      <div id="options-video" className="card"><div className="card-title">Motion</div><div className="tiny">World detail is fixed at full detail. This control only changes camera/input feel.</div>
        <label className="tiny">Motion <select data-input="motion-feel" value={visual.motion || "classic"}><option value="smooth">Smooth</option><option value="classic">Classic hop</option><option value="low">Low-power</option></select></label>
        <button className="btn" data-click="visual-comfort">Comfort motion preset</button>
      </div>
      <div id="options-controls" className="card"><div className="card-title">Controls</div><div className="tiny">1 Axe · 2 Pickaxe · 3 Hammer · 4 Capture · Esc closes the current panel before reopening settings.</div><button className="btn" data-click="tutorial-restart">Restart tutorial</button><button className="btn" data-click="modal-close">Close</button></div>
    </div>
  </div>;
}