import { publicRuntimeConfigScript } from "./runtimeConfig";

const PRODUCTION_POLISH_CSS = `
:root{
  --sc-layer-world:0;
  --sc-layer-hud:20;
  --sc-layer-panel:45;
  --sc-layer-notice:80;
  --sc-layer-menu:90;
  --sc-layer-modal:110;
}
#notice-root,.notice-root,.production-notice-rail{z-index:var(--sc-layer-notice)!important;pointer-events:none;}
.notice-rail.production-notice-rail{position:fixed;top:calc(16px + env(safe-area-inset-top));right:calc(16px + env(safe-area-inset-right));display:grid;gap:8px;max-width:min(420px,calc(100vw - 24px));}
.production-notice{pointer-events:auto;backdrop-filter:blur(14px);box-shadow:0 16px 42px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.10) inset;}
.utility-pop{z-index:var(--sc-layer-panel);}
.utility-pop__header,.modal-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;}
.utility-pop__header h3{margin:0;}
.utility-close,.settings-close{min-width:34px;min-height:34px;border-radius:999px;display:inline-grid;place-items:center;font-weight:900;line-height:1;}
.modal-wrap{z-index:var(--sc-layer-modal)!important;}
.settings-layer{z-index:var(--sc-layer-modal)!important;}
.ui31-login-card,.ui31-capital-card{border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 80px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.05) inset;}
.ui31-login-copy{font-size:clamp(15px,1.6vw,18px);line-height:1.55;}
.ui31-login-loop{grid-template-columns:repeat(4,minmax(0,1fr));}
.ui31-entry-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0 12px;}
.ui31-entry-fields label{display:grid;gap:6px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:rgba(255,255,255,.72);}
.ui31-entry-fields em{font-style:normal;color:rgba(255,255,255,.48);}
.ui31-entry-fields input,.profile-referral-input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(8,12,22,.68);color:#fff;padding:12px 13px;font-size:15px;outline:none;}
.ui31-entry-fields input:focus,.profile-referral-input:focus{border-color:rgba(20,241,149,.72);box-shadow:0 0 0 3px rgba(20,241,149,.14);}
.build-first-rule,.building-clarity-list{border-radius:14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);padding:10px;margin:10px 0;}
.building-clarity-list{display:grid;gap:6px;}
.building-clarity-list div{display:grid;grid-template-columns:86px 1fr;gap:8px;font-size:12px;line-height:1.35;}
.building-clarity-list b{color:#ffd76e;text-transform:uppercase;letter-spacing:.04em;font-size:11px;}
.production-build-choice{display:grid;gap:4px;text-align:left;}
.production-build-choice em{font-style:normal;color:#ffd76e;font-size:11px;font-weight:800;}
.player-hud__territory{white-space:normal;text-align:right;max-width:190px;}
.settings-panel.pause-panel{width:min(980px,96vw);max-height:min(90vh,860px);overflow:auto;border-radius:24px;}
.sc-settings-tabs{position:sticky;top:0;z-index:2;display:flex;gap:8px;flex-wrap:wrap;padding:8px 0 12px;background:linear-gradient(180deg,rgba(10,14,24,.96),rgba(10,14,24,.72));backdrop-filter:blur(12px);}
.sc-settings-tabs a{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:inherit;text-decoration:none;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;}
.production-options-modal .card{display:grid;gap:10px;align-content:start;}
.exchange-widget{display:grid;gap:12px;}
.exchange-hero,.exchange-balances,.exchange-card{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);border-radius:18px;padding:14px;}
.exchange-balances{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.exchange-balance{display:grid;gap:4px;}
.exchange-balance b{font-size:22px;}
@media (max-width:720px){.ui31-entry-fields,.exchange-balances{grid-template-columns:1fr}.ui31-login-loop{grid-template-columns:repeat(2,minmax(0,1fr))}.notice-rail.production-notice-rail{left:12px;right:12px;top:12px}.building-clarity-list div{grid-template-columns:1fr}.settings-panel.pause-panel{width:calc(100vw - 16px);border-radius:18px}}
`;

/* TradJS server page: one mount node, runtime config injected before the client boots. */
export default function GamePage() {
  return <>
    <style dangerouslySetInnerHTML={{ __html: PRODUCTION_POLISH_CSS }} />
    <script dangerouslySetInnerHTML={{ __html: publicRuntimeConfigScript() }} />
    <div id="solcraft-root" />
  </>;
}
