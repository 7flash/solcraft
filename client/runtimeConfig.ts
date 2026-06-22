type PublicRuntimeConfig = {
  releaseMode?: string;
  visualTheme?: string;
  forceProceduralTerrain?: boolean;
  atlasMode?: "procedural" | "runtime" | "auto";
};

declare global {
  interface Window { __SOLCRAFT_CONFIG__?: PublicRuntimeConfig; }
}

export function solcraftRuntimeConfig(): Required<PublicRuntimeConfig> {
  const cfg = typeof window !== "undefined" ? window.__SOLCRAFT_CONFIG__ || {} : {};
  return {
    releaseMode: String(cfg.releaseMode || "ecs"),
    visualTheme: String(cfg.visualTheme || "dusk-industrial"),
    forceProceduralTerrain: cfg.forceProceduralTerrain !== false,
    atlasMode: cfg.atlasMode === "procedural" || cfg.atlasMode === "runtime" || cfg.atlasMode === "auto" ? cfg.atlasMode : "auto",
  };
}

export function solcraftRuntimeFlag(name: keyof PublicRuntimeConfig, fallback: any = false) {
  const cfg = solcraftRuntimeConfig() as any;
  return cfg[name] ?? fallback;
}
