function configuredAdminNames() {
  const raw = process.env.SOLCRAFT_ADMIN_PLAYERS || process.env.SOLCRAFT_ADMIN_NAMES || "second";
  return new Set(String(raw).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function isAdminPlayerName(name: string) {
  return configuredAdminNames().has(String(name || "").trim().toLowerCase());
}

export function devCommandsEnabled() {
  return String(process.env.SOLCRAFT_ENABLE_DEV_COMMANDS || "").trim() === "1" || String(process.env.NODE_ENV || "") === "development";
}
