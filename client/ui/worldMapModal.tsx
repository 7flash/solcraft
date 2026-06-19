// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { worldMapLegendItems, worldMapModeHelp, worldMapSummary } from "./worldMapModel";

export function WorldMapModalView(props: any) {
  const { map, admin = false, onDraw } = props;
  setTimeout(() => {
    const cv = document.getElementById("sc-worldmap-canvas");
    if (cv && typeof onDraw === "function") onDraw(cv);
  }, 0);

  const help = worldMapModeHelp(admin);
  const legend = worldMapLegendItems();

  return <div className="modal ui2-worldmap-modal">
    <h2>World Map</h2>
    <p className="tiny">Lightweight overview from the minimap data. It does not render the whole 3D world, so movement stays fast.</p>
    <div className="worldmap-road-note">Wonder districts are outlined; tan road cells show settlement links to nearby Wonders.</div>
    <div className="worldmap-legend ui2-worldmap-legend">
      {legend.map((item: any) => <span><i className={`worldmap-dot ${item.dotClass}`} />{item.label}</span>)}
      <span>{worldMapSummary({ map })}</span>
    </div>
    <canvas id="sc-worldmap-canvas" className="worldmap-canvas" width="1200" height="760" data-click="worldmap-click" />
    <p className="worldmap-help"><span><b>{help.label}</b> {help.text}</span></p>
    <div className="row ui2-worldmap-actions">
      <button className="btn" data-click="modal-close">Close</button>
      <button className="btn primary" data-click="camera-zoom-reset">Reset camera</button>
    </div>
  </div>;
}
