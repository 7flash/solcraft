export function moreTileClass(item: any, activePanel: string) {
  return "more-tile" + (item?.panel && String(activePanel || "") === String(item.panel) ? " on" : "");
}

export function soundStatus(musicMuted: boolean, uiMuted: boolean) {
  return musicMuted && uiMuted ? "Muted" : "On";
}

export function scaleControlKey(kind: string) {
  return kind === "menu" ? "menuScale" : "uiScale";
}

export function scaleResetLabel(kind: string) {
  return kind === "menu" ? "menu" : "interface";
}

export function activeScaleButtonClass(value: number, preset: number) {
  return "btn" + (Math.abs(Number(value || 0) - Number(preset || 0)) < 0.01 ? " primary" : "");
}

export function activeCameraButtonClass(value: number, preset: number) {
  return "btn" + (Math.abs(Number(value || 0) - Number(preset || 0)) < 0.02 ? " primary" : "");
}

export const SCALE_PRESETS = [0.75, 1, 1.25, 1.5] as const;
export const CAMERA_PRESETS = [0.85, 1, 1.35, 1.7, 2.05] as const;
