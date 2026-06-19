export type TopChromeButtonId = "worldMap" | "zoomOut" | "zoomIn" | "settings" | "sound" | "logout";

export type TopChromeState = {
  settingsOpen?: boolean;
  muted?: boolean;
};

export type TopChromeButton = {
  id: TopChromeButtonId;
  className: string;
  ariaLabel: string;
  tipTitle: string;
  tipBody: string;
  click: string;
  panel?: string;
  icon?: string;
  fallback: string;
  text?: string;
};

function chromeClass(extra = "", on = false): string {
  return ["chrome-btn", extra, on ? "on" : ""].filter(Boolean).join(" ");
}

export function topChromeButtons(state: TopChromeState = {}): TopChromeButton[] {
  const settingsOpen = !!state.settingsOpen;
  const muted = !!state.muted;
  return [
    {
      id: "worldMap",
      className: chromeClass("zoom-btn"),
      ariaLabel: "World map",
      tipTitle: "World map",
      tipBody: "Open the lightweight whole-known-map overlay. Admin can jump from there; normal players use it for overview.",
      click: "open-world-map",
      fallback: "🗺",
      text: "🗺",
    },
    {
      id: "zoomOut",
      className: chromeClass("zoom-btn"),
      ariaLabel: "Zoom out",
      tipTitle: "Zoom out",
      tipBody: "Zoom out a little. For whole-map overview use the map button/minimap.",
      click: "camera-zoom-out",
      fallback: "−",
      text: "−",
    },
    {
      id: "zoomIn",
      className: chromeClass("zoom-btn"),
      ariaLabel: "Zoom in",
      tipTitle: "Zoom in",
      tipBody: "Move the camera closer. Mouse wheel up or + also zooms in.",
      click: "camera-zoom-in",
      fallback: "＋",
      text: "＋",
    },
    {
      id: "settings",
      className: chromeClass("", settingsOpen),
      ariaLabel: "Settings",
      tipTitle: "Settings",
      tipBody: "Open sound, visual, tutorial reset, interface/menu scale, and camera zoom controls.",
      click: "toggle-panel",
      panel: "settings",
      icon: "settings",
      fallback: "⚙",
    },
    {
      id: "sound",
      className: chromeClass(muted ? "muted" : ""),
      ariaLabel: muted ? "Sound muted" : "Sound on",
      tipTitle: muted ? "Sound muted" : "Sound on",
      tipBody: "Click to toggle game music and UI sound.",
      click: "toggle-ui-sound",
      icon: "sound",
      fallback: "♪",
    },
    {
      id: "logout",
      className: chromeClass(),
      ariaLabel: "Logout",
      tipTitle: "Logout",
      tipBody: "Leave this local session and return to the login screen.",
      click: "forget-session",
      icon: "logout",
      fallback: "↩",
    },
  ];
}
