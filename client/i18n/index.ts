// @ts-nocheck
import en from "./en.json";

type Vars = Record<string, string | number | boolean | null | undefined>;

type Catalog = Record<string, any>;

const catalog: Catalog = en as Catalog;

function lookup(path: string): any {
  return String(path || "").split(".").filter(Boolean).reduce((node: any, part: string) => {
    if (node && typeof node === "object" && Object.prototype.hasOwnProperty.call(node, part)) return node[part];
    return undefined;
  }, catalog);
}

function formatTemplate(value: string, vars?: Vars) {
  if (!vars) return value;
  return value.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_m, key) => {
    const next = vars[key];
    return next == null ? "" : String(next);
  });
}

export function t(key: string, fallback = "", vars?: Vars): string {
  const value = lookup(key);
  const text = typeof value === "string" ? value : fallback || key;
  return formatTemplate(text, vars);
}

export function tArray<T = any>(key: string, fallback: T[] = []): T[] {
  const value = lookup(key);
  return Array.isArray(value) ? value as T[] : fallback;
}

export function tObject<T = any>(key: string, fallback: T): T {
  const value = lookup(key);
  return value && typeof value === "object" && !Array.isArray(value) ? value as T : fallback;
}

export function activeLocale() {
  return String(catalog?.meta?.language || "en");
}

export const messages = catalog;
