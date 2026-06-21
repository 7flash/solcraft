// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { t } from "../i18n";
import { activeCameraButtonClass, activeScaleButtonClass, CAMERA_PRESETS, scaleControlKey, scaleResetLabel, SCALE_PRESETS, soundStatus } from "./utilityPanelModel";

export function ScaleControlView(props: any) {
  const { kind, title, note, ui, clampUiScale, uiScalePct, uiScaleMin, uiScaleMax, uiScaleStep } = props;
  const key = scaleControlKey(kind);
  const value = clampUiScale(ui?.[key] ?? 1, 1);
  return <div className="settings-card compact">
    <div className="settings-card-head"><b>{title}</b><span>{uiScalePct(value)}</span></div>
    <div className="settings-scale-row">
      <button className="btn" data-click="ui-scale-step" data-kind={kind} data-delta={-uiScaleStep} aria-label={t("settings.smaller", "{title} smaller", { title })}>−</button>
      <input type="range" min={uiScaleMin} max={uiScaleMax} step="0.02" value={value} data-input="ui-scale" data-kind={kind} aria-label={title} />
      <button className="btn" data-click="ui-scale-step" data-kind={kind} data-delta={uiScaleStep} aria-label={t("settings.larger", "{title} larger", { title })}>+</button>
    </div>
    <div className="settings-presets">
      {SCALE_PRESETS.map((preset) => <button className={activeScaleButtonClass(value, preset)} data-click="ui-scale-set" data-kind={kind} data-value={preset}>{uiScalePct(preset)}</button>)}
    </div>
    <button className="btn" data-click="ui-scale-reset" data-kind={kind}>{t("settings.reset", "Reset {label}", { label: scaleResetLabel(kind) })}</button>
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
  const zoom = visual?.cameraZoom || 1;
  return <div className="settings-layer pause-layer">
    <button className="settings-scrim" data-click="panel-close" aria-label={t("settings.resumeAria", "Resume game")} />
    <section className="settings-panel pause-panel" data-stop-pointerdown="1" role="dialog" aria-modal="true" aria-label={t("settings.pauseAria", "Pause menu")}>
      <button className="settings-close" data-click="panel-close" aria-label={t("settings.resumeAria", "Resume game")}>×</button>
      <div className="settings-top pause-top">
        <div>
          <p className="settings-kicker">{t("settings.paused", "Paused")}</p>
          <h3>{t("settings.title", "Settings")}</h3>
          <p>{t("settings.intro", "Audio, visuals, guide, and session controls live here. Press Esc again to close.")}</p>
        </div>
        <button className="btn primary" data-click="panel-close">{t("settings.resume", "Resume")}</button>
      </div>
      <div className="settings-grid pause-grid">
        <div className="settings-card wide">
          <div className="settings-card-head"><b>{t("settings.audio", "Audio")}</b><span>{soundStatus(!!musicMuted, !!uiMuted)}</span></div>
          <p className="settings-note">{t("settings.audioNote", "Browsers often require a click before music can start. Use Start music after entering the world.")}</p>
          <div className="settings-actions">
            <button className="btn primary" data-click="start-music"><Icon name="sound" fallback="♪" /> {t("settings.startMusic", "Start music")}</button>
            <button className="btn" data-click="toggle-music"><Icon name="sound" fallback="♪" /> {musicMuted ? t("settings.musicOn", "Music on") : t("settings.musicOff", "Music off")}</button>
            <button className="btn" data-click="toggle-ui-sound"><Icon name="sound" fallback="♪" /> {uiMuted ? t("settings.uiSoundsOn", "UI sounds on") : t("settings.uiSoundsOff", "UI sounds off")}</button>
          </div>
        </div>
        <div className="settings-card wide">
          <div className="settings-card-head"><b>{t("settings.visuals", "Visuals")}</b><span>{visual?.quality || "fast"}</span></div>
          <div className="settings-actions stacked">
            <label className="settings-field"><span>{t("settings.quality", "Quality")}</span><select className="settings-select" data-input="visual-quality" value={visual?.quality || "fast"}>
              <option value="auto">{t("settings.auto", "Auto")}</option>
              <option value="crisp">{t("settings.crisp", "Crisp")}</option>
              <option value="balanced">{t("settings.balanced", "Balanced")}</option>
              <option value="fast">{t("settings.fast", "Fast")}</option>
            </select></label>
            <label className="settings-field"><span>{t("settings.motion", "Motion")}</span><select className="settings-select" data-input="motion-feel" value={visual?.motion || "classic"}>
              <option value="smooth">{t("settings.smooth", "Smooth")}</option>
              <option value="classic">{t("settings.classicHop", "Classic hop")}</option>
              <option value="low">{t("settings.lowPower", "Low-power")}</option>
            </select></label>
            <button className="btn" data-click="visual-comfort">{t("settings.comfortPreset", "Comfort preset")}</button>
            <button className="btn" data-click="reload-art">{t("settings.reloadArt", "Reload art")}</button>
          </div>
        </div>
        <ScaleControlView kind="ui" title={t("settings.interfaceSize", "Interface size · {value}", { value: uiPct })} note={t("settings.interfaceNote", "HUD, minimap, toolbelt, tooltips, and panels.")} ui={ui} clampUiScale={clampUiScale} uiScalePct={uiScalePct} uiScaleMin={uiScaleMin} uiScaleMax={uiScaleMax} uiScaleStep={uiScaleStep} />
        <div className="settings-card compact">
          <div className="settings-card-head"><b>{t("settings.camera", "Camera")}</b><span>{cameraZoomPct(zoom)}</span></div>
          <div className="settings-scale-row">
            <button className="btn" data-click="camera-zoom-in" aria-label={t("settings.cameraCloser", "Camera closer")}>＋</button>
            <input type="range" min={cameraZoomMin} max={cameraZoomMax} step="0.01" value={zoom} data-input="camera-zoom" aria-label={t("settings.cameraView", "Camera view")} />
            <button className="btn" data-click="camera-zoom-out" aria-label={t("settings.cameraFarther", "Camera farther")}>−</button>
          </div>
          <div className="settings-presets">
            {CAMERA_PRESETS.map((preset) => <button className={activeCameraButtonClass(zoom, preset)} data-click="camera-zoom-set" data-value={preset}>{preset === 1 ? t("settings.default", "Default") : cameraZoomPct(preset)}</button>)}
          </div>
          <button className="btn" data-click="camera-zoom-reset">{t("settings.resetCamera", "Reset camera")}</button>
        </div>
        <div className="settings-card wide">
          <div className="settings-card-head"><b>{t("settings.controls", "Controls")}</b><span>{t("settings.toolbelt", "Toolbelt")}</span></div>
          <p className="settings-note">{t("settings.controlsNote", "Use 1–6 for axe, pickaxe, hammer, shovel, capture, and sword. Esc opens this menu.")}</p>
          <div className="settings-actions">
            <button className="btn" data-click="tutorial-restart">{t("settings.restartBasics", "Restart basics")}</button>
          </div>
        </div>
      </div>
      <div className="settings-danger">
        <div className="settings-divider" />
        <button className="btn warn" data-click="forget-session"><Icon name="logout" fallback="↩" /> {t("settings.logout", "Logout")}</button>
      </div>
    </section>
  </div>;
}
