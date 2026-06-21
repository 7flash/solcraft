// @ts-nocheck
import { configureMinimapCanvas } from "./minimapShell";

export function createHudRoots(root: HTMLElement, opts: any = {}) {
  root.className = "sc-root";
  root.replaceChildren(); // hot-reload safe: no double HUD/canvas ghosts

  const worldEl = document.createElement("div");
  worldEl.className = "sc-world";
  const hudEl = document.createElement("div");
  hudEl.className = "sc-hud";
  root.append(worldEl, hudEl);

  const preventGameContext = (ev: any) => {
    if (root.contains(ev.target)) { ev.preventDefault(); return false; }
  };
  root.addEventListener("contextmenu", preventGameContext, { capture: true });
  hudEl.addEventListener("contextmenu", preventGameContext, { capture: true });
  worldEl.addEventListener("contextmenu", preventGameContext, { capture: true });
  document.addEventListener("contextmenu", preventGameContext, { capture: true });

  /* region roots — each its own tradjs render target */
  const mk = (cls: string) => { const d = document.createElement("div"); if (cls) d.className = cls; hudEl.appendChild(d); return d; };
  const topEl = mk("sc-top");
  const hudRoot = document.createElement("div"); topEl.appendChild(hudRoot);
  const actionsRoot = document.createElement("div"); topEl.appendChild(actionsRoot);
  const utilityRoot = mk("");
  const minimapEl = configureMinimapCanvas(document.createElement("canvas"), { onOpen: opts.onOpenMap || (() => {}) });
  hudEl.appendChild(minimapEl);
  const chatEl = mk("");
  const bottomRoot = mk("");
  const toastEl = document.createElement("div"); toastEl.className = "toast"; hudEl.appendChild(toastEl);
  const noticeRoot = mk("");
  const channelEl = document.createElement("div"); channelEl.className = "channel";
  channelEl.innerHTML = `<div id="sc-ch-label">Chopping…</div><div class="cbar"><i id="sc-ch-fill"></i></div>`;
  hudEl.appendChild(channelEl);
  const ctxEl = document.createElement("div"); ctxEl.className = "ctx"; ctxEl.style.display = "none"; hudEl.appendChild(ctxEl);
  const tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.style.display = "none"; hudEl.appendChild(tipEl);
  const vignetteEl = document.createElement("div"); vignetteEl.className = "sc-vignette"; hudEl.appendChild(vignetteEl);
  const guideRoot = mk("");
  const modalRoot = mk("");
  const menuRoot = mk("");

  return {
    worldEl, hudEl, topEl, hudRoot, actionsRoot, utilityRoot, minimapEl, chatEl,
    bottomRoot, toastEl, noticeRoot, channelEl, ctxEl, tipEl, vignetteEl,
    guideRoot, modalRoot, menuRoot,
  };
}
