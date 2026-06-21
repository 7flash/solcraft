// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { capitalServiceAvailable, capitalServiceInfo } from "../world/capitalServices.ts";

export function CapitalServicePanelView({ service, distance = 99 }: any) {
  if (!service) return <div />;
  const info = capitalServiceInfo(service.service || service.id);
  const near = capitalServiceAvailable(distance, info);
  const coords = `${Number(service.x || 0)},${Number(service.z || 0)}`;
  return <section className="ui30-panel ui41-capital-service-panel">
    <button className="ui30-close" data-click="capital-service-close" aria-label="Close">×</button>
    <div className="ui41-service-hero">
      <div className="ui41-service-glyph" aria-hidden="true">{info.glyph}</div>
      <div>
        <p className="ui30-eyebrow">{info.eyebrow}</p>
        <h2>{service.name || info.title}</h2>
        <p>{info.summary}</p>
      </div>
      <span className="ui41-service-chip">{coords}</span>
    </div>
    <div className="ui41-service-note">
      <b>{near ? "Service ready" : "Walk closer"}</b>
      <span>{near ? "You are beside this capital service." : "Capital services activate when you stand beside their building."}</span>
    </div>
    <div className="ui30-action-stack">
      <button className="ui30-btn primary" data-click="capital-service-action" data-service={info.id} disabled={!near && info.requiresNear}>{near ? info.actionLabel : "Too far"}</button>
      <button className="ui30-btn" data-click="capital-service-walk">Walk near</button>
      <button className="ui30-btn ghost" data-click="capital-service-close">Close</button>
    </div>
  </section>;
}
