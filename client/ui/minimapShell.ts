export const MINIMAP_ID = "sc-minimap";
export const MINIMAP_CLASS = "minimap ui2-minimap";
export const MINIMAP_TITLE = "Open world map";
export const MINIMAP_SIZE = 190;

export type MinimapShellOptions = {
  onOpen?: () => void;
};

export function configureMinimapCanvas(canvas: HTMLCanvasElement, options: MinimapShellOptions = {}) {
  canvas.id = MINIMAP_ID;
  canvas.className = MINIMAP_CLASS;
  canvas.width = MINIMAP_SIZE;
  canvas.height = MINIMAP_SIZE;
  canvas.title = MINIMAP_TITLE;
  if (options.onOpen) canvas.addEventListener("click", options.onOpen);
  return canvas;
}
