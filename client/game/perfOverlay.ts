export type PerfSample = {
  name: string;
  ms: number;
  at?: number;
  meta?: Record<string, unknown> | string | number | boolean | null;
};

export type PerfOverlayOptions = {
  enabled?: boolean;
  label?: string;
  now?: () => number;
  maxSamples?: number;
  consoleBudgetMs?: number;
};

export class RollingMetric {
  private readonly values: number[] = [];
  readonly max: number;

  constructor(max = 90) { this.max = max; }

  push(value: number) {
    if (!Number.isFinite(value)) return;
    this.values.push(Math.max(0, value));
    while (this.values.length > this.max) this.values.shift();
  }

  clear() { this.values.length = 0; }
  get count() { return this.values.length; }
  get last() { return this.values[this.values.length - 1] ?? 0; }

  avg() {
    if (!this.values.length) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  maxValue() {
    return this.values.length ? Math.max(...this.values) : 0;
  }

  percentile(p = 0.95) {
    if (!this.values.length) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1));
    return sorted[idx] ?? 0;
  }
}

export function formatMs(ms: number) {
  if (!Number.isFinite(ms)) return "—";
  if (ms >= 100) return `${Math.round(ms)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

export function fpsFromDeltaMs(deltaMs: number) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return 1000 / deltaMs;
}

export function isLikelyUiStall(samples: { uiMs: number; renderMs: number; frameMs: number }) {
  return samples.frameMs > 20 && samples.uiMs > samples.renderMs * 1.35 && samples.uiMs > 6;
}

export function perfOverlayEnabledFromUrl(search = "", storage: Storage | null = null) {
  const q = String(search || "");
  if (/[?&]perf=(1|true|yes|on)\b/i.test(q)) return true;
  if (/[?&]perf=(0|false|no|off)\b/i.test(q)) return false;
  try { return storage?.getItem("solcraft:perfOverlay:v1") === "1"; } catch { return false; }
}

export class PerfRecorder {
  readonly metrics = new Map<string, RollingMetric>();
  readonly marks: PerfSample[] = [];
  readonly now: () => number;
  private readonly maxSamples: number;

  constructor(options: PerfOverlayOptions = {}) {
    this.now = options.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.maxSamples = Math.max(30, Math.min(600, Number(options.maxSamples || 180)));
  }

  metric(name: string) {
    let m = this.metrics.get(name);
    if (!m) { m = new RollingMetric(this.maxSamples); this.metrics.set(name, m); }
    return m;
  }

  record(name: string, ms: number, meta?: PerfSample["meta"]) {
    this.metric(name).push(ms);
    this.marks.push({ name, ms, meta, at: this.now() });
    while (this.marks.length > this.maxSamples) this.marks.shift();
    return ms;
  }

  measure<T>(name: string, fn: () => T, meta?: PerfSample["meta"]): T {
    const start = this.now();
    try { return fn(); }
    finally { this.record(name, this.now() - start, meta); }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>, meta?: PerfSample["meta"]): Promise<T> {
    const start = this.now();
    try { return await fn(); }
    finally { this.record(name, this.now() - start, meta); }
  }
}

function metricLine(rec: PerfRecorder, name: string, label = name, budget = 16.7) {
  const m = rec.metrics.get(name);
  if (!m || !m.count) return `${label}: —`;
  const p95 = m.percentile(0.95);
  const hot = p95 > budget ? " ⚠" : "";
  return `${label}: ${formatMs(m.last)} avg ${formatMs(m.avg())} p95 ${formatMs(p95)}${hot}`;
}

export function createPerfOverlay(root: HTMLElement, options: PerfOverlayOptions = {}) {
  const recorder = new PerfRecorder(options);
  const label = options.label || "SolCraft perf";
  const consoleBudgetMs = Number(options.consoleBudgetMs || 24) || 24;
  let enabled = !!options.enabled;
  let slowConsoleAt = 0;
  const el = document.createElement("div");
  el.className = "sc-perf-overlay";
  el.hidden = !enabled;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  root.appendChild(el);

  function persist() {
    try { localStorage.setItem("solcraft:perfOverlay:v1", enabled ? "1" : "0"); } catch {}
  }

  function render() {
    if (!enabled) return;
    const frame = recorder.metrics.get("frame.total");
    const frameAvg = frame?.avg() || 0;
    const fps = frameAvg ? fpsFromDeltaMs(frameAvg) : 0;
    const latest = recorder.marks.slice(-4).map((m) => `${m.name} ${formatMs(m.ms)}`).join(" · ");
    const ui = Math.max(
      recorder.metrics.get("ui.paint")?.percentile(0.95) || 0,
      recorder.metrics.get("ui.region")?.percentile(0.95) || 0,
    );
    const renderMs = recorder.metrics.get("webgl.render")?.percentile(0.95) || 0;
    const className = isLikelyUiStall({ uiMs: ui, renderMs, frameMs: frame?.percentile(0.95) || 0 }) ? "sc-perf-overlay hot" : "sc-perf-overlay";
    if (el.className !== className) el.className = className;
    el.textContent = [
      `${label} · F8 · ${fps ? fps.toFixed(0) : "—"}fps`,
      metricLine(recorder, "frame.total", "frame", 16.7),
      metricLine(recorder, "webgl.tick", "world", 8),
      metricLine(recorder, "webgl.render", "webgl", 6),
      metricLine(recorder, "ui.paint", "paint", 6),
      metricLine(recorder, "snap.apply", "snapshot", 8),
      metricLine(recorder, "net.state", "state api", 80),
      latest ? `last: ${latest}` : "last: —",
    ].join("\n");
  }

  const timer = window.setInterval(render, 250);

  function record(name: string, ms: number, meta?: PerfSample["meta"]) {
    recorder.record(name, ms, meta);
    if (enabled && ms >= consoleBudgetMs) {
      const now = recorder.now();
      if (now - slowConsoleAt > 500) {
        slowConsoleAt = now;
        console.warn(`[client.measure:${name}] ${formatMs(ms)}`, meta || "");
      }
    }
    return ms;
  }

  function measure<T>(name: string, fn: () => T, meta?: PerfSample["meta"]): T {
    const start = recorder.now();
    try { return fn(); }
    finally { record(name, recorder.now() - start, meta); }
  }

  async function measureAsync<T>(name: string, fn: () => Promise<T>, meta?: PerfSample["meta"]): Promise<T> {
    const start = recorder.now();
    try { return await fn(); }
    finally { record(name, recorder.now() - start, meta); }
  }

  return {
    recorder,
    get enabled() { return enabled; },
    setEnabled(next: boolean) { enabled = !!next; el.hidden = !enabled; persist(); render(); },
    toggle() { enabled = !enabled; el.hidden = !enabled; persist(); render(); return enabled; },
    record,
    measure,
    measureAsync,
    render,
    dispose() { clearInterval(timer); el.remove(); },
  };
}
