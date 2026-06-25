export type ResourcePrismPart = {
  k: string;
  ox: number;
  oz: number;
  y: number;
  w: number;
  d: number;
  h: number;
  top: string;
  left?: string;
  right?: string;
};

function p(k: string, ox: number, oz: number, y: number, w: number, d: number, h: number, top: string, left?: string, right?: string): ResourcePrismPart {
  return { k, ox, oz, y, w, d, h, top, left, right };
}

function groundShadow(y0: number, scale = 1): ResourcePrismPart[] {
  return [
    p("ground-shadow", 0.00, 0.03, y0 - 0.012, 0.72 * scale, 0.42 * scale, 0.018, "#101b13", "#0b130e", "#070e0a"),
  ];
}

export function resourceRecipeFor(type: string, y0 = 0): ResourcePrismPart[] {
  const t = String(type || "tree").toLowerCase();

  if (t === "tree") return [
    ...groundShadow(y0, 0.96),
    // Prism-tree cluster: one readable trunk and three offset leaf shelves.
    p("trunk-low",    0.00,  0.02, y0,        0.16, 0.16, 0.34, "#8b5628", "#6b3d1d", "#4c2b15"),
    p("trunk-high",   0.00,  0.02, y0 + 0.30, 0.13, 0.13, 0.24, "#9b6432", "#6b3d1d", "#4c2b15"),
    p("leaf-shelf-a", 0.00,  0.00, y0 + 0.48, 0.72, 0.50, 0.14, "#2f9f4f", "#237d3f", "#165d2f"),
    p("leaf-shelf-b",-0.07, -0.04, y0 + 0.61, 0.56, 0.38, 0.13, "#47b85a", "#2f9148", "#20703a"),
    p("leaf-shelf-c", 0.08,  0.02, y0 + 0.73, 0.40, 0.28, 0.11, "#6acb63", "#45a856", "#2c8346"),
    p("leaf-notch",   0.24,  0.16, y0 + 0.56, 0.20, 0.18, 0.10, "#1f7e3e", "#176334", "#114c29"),
  ];

  if (t === "rock") return [
    ...groundShadow(y0, 0.92),
    // Rock outcrop: multiple offset chips make a harvestable node read as a pile,
    // not a tiny square marker on a pale tile.
    p("base-slab",   0.00,  0.02, y0,        0.68, 0.44, 0.08, "#9fa9ad", "#727d83", "#555f65"),
    p("main-chunk", -0.10, -0.07, y0 + 0.07, 0.46, 0.32, 0.20, "#cfd6d6", "#9ba5a8", "#747f82"),
    p("back-chip",   0.20, -0.13, y0 + 0.08, 0.28, 0.20, 0.15, "#b5bebf", "#858f92", "#626d70"),
    p("front-chip",  0.18,  0.14, y0 + 0.05, 0.24, 0.18, 0.11, "#8f9a9e", "#687379", "#4d575d"),
    p("bright-cap", -0.16, -0.12, y0 + 0.25, 0.24, 0.16, 0.06, "#e0e5e4", "#aeb7b8", "#7c8789"),
  ];

  return [
    ...groundShadow(y0, 0.84),
    // Food nodes are low crop beds, intentionally different from trees/rocks.
    p("soil-bed", 0.00, 0.00, y0,        0.66, 0.46, 0.07, "#5c3a20", "#412713", "#301c0e"),
    p("row-a",   -0.25, -0.12, y0 + 0.06, 0.07, 0.38, 0.18, "#3faa55", "#2f8f46", "#216f37"),
    p("row-b",   -0.08,  0.02, y0 + 0.06, 0.07, 0.42, 0.24, "#ffd76e", "#cf9d35", "#9d7626"),
    p("row-c",    0.10, -0.05, y0 + 0.06, 0.07, 0.36, 0.20, "#55c96a", "#36994c", "#23763a"),
    p("row-d",    0.27,  0.12, y0 + 0.06, 0.07, 0.30, 0.16, "#d9b94c", "#aa862b", "#7d6120"),
  ];
}
