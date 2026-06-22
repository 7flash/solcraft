type PublicRuntimeConfig = {
  releaseMode: string;
  visualTheme: string;
  forceProceduralTerrain: boolean;
  atlasMode: "procedural" | "runtime" | "auto";
};

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envChoice<T extends string>(name: string, choices: readonly T[], fallback: T): T {
  const raw = String(process.env[name] ?? "").trim().toLowerCase() as T;
  return choices.includes(raw) ? raw : fallback;
}

export function publicRuntimeConfig(): PublicRuntimeConfig {
  return {
    releaseMode: String(process.env.SOLCRAFT_RELEASE_MODE || process.env.SOLCRAFT_BACKEND_MODE || "ecs"),
    visualTheme: String(process.env.SOLCRAFT_VISUAL_THEME || "dusk-industrial"),
    forceProceduralTerrain: envFlag("SOLCRAFT_PROCEDURAL_TERRAIN", true),
    atlasMode: envChoice("SOLCRAFT_ATLAS_MODE", ["procedural", "runtime", "auto"] as const, "auto"),
  };
}

export function publicRuntimeConfigScript() {
  const json = JSON.stringify(publicRuntimeConfig()).replace(/</g, "\\u003c");
  return `window.__SOLCRAFT_CONFIG__=${json};`;
}
