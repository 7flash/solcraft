// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { activeCameraButtonClass, activeScaleButtonClass, CAMERA_PRESETS, scaleControlKey, scaleResetLabel, SCALE_PRESETS, soundStatus } from "./utilityPanelModel";

export function ScaleControlView(props: any) {
  const { kind, title, note, ui, clampUiScale, uiScalePct, uiScaleMin, uiScaleMax, uiScaleStep } = props;
  const key = scaleControlKey(kind);
  const value = clampUiScale(ui?.[key] ?? 1, 1);
  return <div className="settings-card">
    <div className="settings-card-head"><b>{title}</b><span>{uiScalePct(value)}</span></div>
    <div className="settings-scale-row">
      <button className="btn" data-click="ui-scale-step" data-kind={kind} data-delta={-uiScaleStep} aria-label={`${title} smaller`}>−</button>
      <input type="range" min={uiScaleMin} max={uiScaleMax} step="0.02" value={value} data-input="ui-scale" data-kind={kind} aria-label={title} />
      <button className="btn" data-click="ui-scale-step" data-kind={kind} data-delta={uiScaleStep} aria-label={`${title} larger`}>+</button>
    </div>
    <div className="settings-presets">
      {SCALE_PRESETS.map((preset) => <button className={activeScaleButtonClass(value, preset)} data-click="ui-scale-set" data-kind={kind} data-value={preset}>{uiScalePct(preset)}</button>)}
    </div>
    {kind === "ui" ? <div className="settings-scale-preview"><span>Aa</span><div><b>Live interface preview</b><small> HUD/buttons scale immediately after you click or drag.</small></div></div> : null}
    <button className="btn" data-click="ui-scale-reset" data-kind={kind}>Reset {scaleResetLabel(kind)}</button>
    <p className="settings-note">{note}</p>
  </div>;
}

export function SettingsPanelView(props: any) {
  const {
    ui,
    visual,
    musicMuted,
    uiMuted,
    clampUiScale,
    uiScalePct,
    cameraZoomPct,
    uiScaleMin,
    uiScaleMax,
    uiScaleStep,
    cameraZoomMin,
    cameraZoomMax,
    UiIcon,
  } = props;
  const Icon = UiIcon || (() => <span />);
  const uiPct = uiScalePct(ui?.uiScale || 1);
  const menuPct = uiScalePct(ui?.menuScale || 1);
  const zoom = visual?.cameraZoom || 1;
  return <div className="settings-layer">
    <button className="settings-scrim" data-click="panel-close" aria-label="Close settings" />
    <section className="settings-panel" data-stop-pointerdown="1" role="dialog" aria-modal="true" aria-label="Settings">
      <button className="settings-close" data-click="panel-close" aria-label="Close settings">×</button>
      <div className="settings-top">
        <div>
          <p className="settings-kicker">Client settings</p>
          <h3>Settings</h3>
          <p>Readable controls for this device. These settings are saved locally, apply instantly, and are separate from browser zoom.</p>
        </div>
      </div>
      <div className="settings-grid">
        <ScaleControlView kind="ui" title={`Interface size · ${uiPct}`} note="HUD, minimap, action bar, tooltips, walkthrough callouts, and game panels." ui={ui} clampUiScale={clampUiScale} uiScalePct={uiScalePct} uiScaleMin={uiScaleMin} uiScaleMax={uiScaleMax} uiScaleStep={uiScaleStep} />
        <ScaleControlView kind="menu" title={`Menu size · ${menuPct}`} note="Login/menu screen size, tuned separately from the in-game interface." ui={ui} clampUiScale={clampUiScale} uiScalePct={uiScalePct} uiScaleMin={uiScaleMin} uiScaleMax={uiScaleMax} uiScaleStep={uiScaleStep} />
        <div className="settings-card wide">
          <div className="settings-card-head"><b>Sound and visuals</b><span>{soundStatus(!!musicMuted, !!uiMuted)}</span></div>
          <p className="settings-note">Quick toggles that used to live in the cramped settings popover.</p>
          <div className="settings-actions">
            <button className="btn primary" data-click="start-music"><Icon name="sound" fallback="♪" /> Start music</button><button className="btn" data-click="toggle-music"><Icon name="sound" fallback="♪" /> {musicMuted ? "Turn music on" : "Turn music off"}</button>
            <button className="btn" data-click="toggle-ui-sound"><Icon name="sound" fallback="♪" /> {uiMuted ? "Turn UI sounds on" : "Turn UI sounds off"}</button>
            <button className="btn" data-click="reload-art">Reload art</button>
            <button className="btn" data-click="ui-scale-reset" data-kind="all">Reset all scale</button>
          </div>
        </div>
        <div className="settings-card">
          <div className="settings-card-head"><b>Visual quality</b><span>{visual?.quality || "fast"}</span></div>
          <p className="settings-note">Controls pixel sharpness and decoration cost. Movement is controlled separately.</p>
          <select className="settings-select" data-input="visual-quality" value={visual?.quality || "fast"}>
            <option value="auto">Auto</option>
            <option value="crisp">Crisp</option>
            <option value="balanced">Balanced</option>
            <option value="fast">Fast</option>
          </select>
        </div>
        <div className="settings-card">
          <div className="settings-card-head"><b>Motion feel</b><span>{visual?.motion || "classic"}</span></div>
          <p className="settings-note">Classic hop is the default arcade feel. Smooth is fluid. Low-power saves battery.</p>
          <select className="settings-select" data-input="motion-feel" value={visual?.motion || "classic"}>
            <option value="smooth">Smooth</option>
            <option value="classic">Classic hop</option>
            <option value="low">Low-power</option>
          </select>
        </div>
        <div className="settings-card wide">
          <div className="settings-card-head"><b>Camera view</b><span>{cameraZoomPct(zoom)}</span></div>
          <p className="settings-note">This is a light local zoom for play. Use World Map for whole-map overview so the 3D scene stays fast.</p>
          <div className="settings-scale-row">
            <button className="btn" data-click="camera-zoom-in" aria-label="Camera closer">＋</button>
            <input type="range" min={cameraZoomMin} max={cameraZoomMax} step="0.01" value={zoom} data-input="camera-zoom" aria-label="Camera view" />
            <button className="btn" data-click="camera-zoom-out" aria-label="Camera farther">−</button>
          </div>
          <div className="settings-presets">
            {CAMERA_PRESETS.map((preset) => <button className={activeCameraButtonClass(zoom, preset)} data-click="camera-zoom-set" data-value={preset}>{preset === 1 ? "Default" : cameraZoomPct(preset)}</button>)}
          </div>
          <button className="btn" data-click="open-world-map">Open World Map</button>
          <button className="btn" data-click="camera-zoom-reset">Reset camera</button>
        </div>
        <div className="settings-card wide">
          <div className="settings-card-head"><b>Tutorial</b><span>Walkthrough</span></div>
          <p className="settings-note">Restart the first-time walkthrough from Character → Guide → Chop → Mine → Capture → Build → Use → Bank.</p>
          <div className="settings-actions">
            <button className="btn primary" data-click="tutorial-restart">Restart tutorial</button>
          </div>
        </div>
      </div>
      <div className="settings-danger">
        <div className="settings-divider" />
        <button className="btn warn" data-click="forget-session"><Icon name="logout" fallback="↩" /> Logout</button>
      </div>
    </section>
  </div>;
}
