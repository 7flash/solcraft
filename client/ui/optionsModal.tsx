// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function OptionsModalView(props: any) {
  const { visual = {}, musicMuted, uiMuted } = props;
  return <div className="modal" style={{ width: "min(560px,94vw)" }}>
    <h2>⚙ Options</h2>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
      <div className="card"><div className="card-title">Sound</div><div className="tiny">Music and UI sounds are controlled separately.</div><button className="btn primary" data-click="start-music">Start uploaded music</button><button className="btn" data-click="toggle-music">{musicMuted ? "Turn music on" : "Turn music off"}</button><button className="btn" data-click="toggle-ui-sound">{uiMuted ? "Turn UI sound on" : "Turn UI sound off"}</button></div>
      <div className="card"><div className="card-title">Terrain feel</div><div className="tiny">Tune procedural terrain until the island feels warm and readable.</div>
        <label className="tiny">Warmth <input type="range" min="0" max="1" step="0.05" value={visual.warmth} data-input="visual-warmth" /></label>
        <label className="tiny">Texture detail <input type="range" min="0" max="1" step="0.05" value={visual.texture} data-input="visual-texture" /></label>
        <label className="tiny">Visual quality <select data-input="visual-quality" value={visual.quality || "fast"}><option value="auto">Auto</option><option value="crisp">Crisp</option><option value="balanced">Balanced</option><option value="fast">Fast</option></select></label>
        <label className="tiny">Motion feel <select data-input="motion-feel" value={visual.motion || "classic"}><option value="smooth">Smooth</option><option value="classic">Classic hop</option><option value="low">Low-power</option></select></label>
        <button className="btn" data-click="visual-comfort">Comfort preset</button>
      </div>
      <div className="card"><div className="card-title">Atlas refresh</div><div className="tiny">Reload published atlases for terrain, buildings, UI icons, and character layers.</div><button className="btn" data-click="reload-atlases-silent">Reload atlases</button></div>
      <div className="card"><div className="card-title">Character</div><div className="tiny">Use the character nearby panel to edit your doll live on the map.</div><button className="btn" data-click="open-character-panel">Open character panel</button></div>
      <div className="card"><div className="card-title">Help</div><div className="tiny">Controls and mechanics reference.</div><button className="btn" data-click="open-help">Open help</button></div>
    </div>
    <div className="row" style={{ marginTop: 12 }}><button className="btn" data-click="modal-close">Close</button></div>
  </div>;
}
