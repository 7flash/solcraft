/* Browser-safe measurement helper for SolCraft client/admin pages.

   measure-fn's full Node build uses node:async_hooks/AsyncLocalStorage for
   async-local nested trace IDs. That is correct on the backend, but it must not
   be imported into browser bundles. This small client helper keeps the same
   call shape we use in page scripts (`measure` / `measureSync`) without any
   Node dependency, so frontend instrumentation cannot break mounting.
*/
// @ts-nocheck

type MeasureAction = string | {
  start?: (() => any) | string;
  end?: (result: any) => any;
  catch?: (error: any) => any;
  timeout?: number;
  budget?: number;
  maxResultLength?: number;
};

type ClientMeasureOptions = { silent?: boolean; maxResultLength?: number };

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
let globalMaxResultLength = 160;

function now() {
  try { return performance.now(); } catch { return Date.now(); }
}

function safeCall(fn: any, fallback: any = "") {
  try { return typeof fn === "function" ? fn() : fn; } catch (e: any) { return fallback || String(e?.message || e || "error"); }
}

function labelOf(action: MeasureAction) {
  if (typeof action === "string") return action;
  if (!action) return "measure";
  return String(safeCall(action.start, "measure"));
}

function compact(value: any, max = globalMaxResultLength) {
  if (max === 0) max = 1000000;
  if (value === undefined) return "";
  let text = "";
  try {
    if (value instanceof Response) text = JSON.stringify({ status: value.status, ok: value.ok });
    else if (typeof value === "string") text = JSON.stringify(value);
    else if (typeof value === "number" || typeof value === "boolean" || value == null) text = String(value);
    else text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (!text) return "";
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

function idFrom(n: number) {
  let x = n;
  let out = "";
  do {
    out = ALPHABET[x % ALPHABET.length] + out;
    x = Math.floor(x / ALPHABET.length) - 1;
  } while (x >= 0);
  return out;
}

export function configureClientMeasure(opts: ClientMeasureOptions = {}) {
  if (Number.isFinite(Number(opts.maxResultLength))) globalMaxResultLength = Number(opts.maxResultLength);
}

export function createClientMeasure(scope: string, opts: ClientMeasureOptions = {}) {
  let seq = 0;
  const stack: string[] = [];
  const silent = () => !!opts.silent || (typeof localStorage !== "undefined" && localStorage.getItem("solcraft:measureSilent") === "1");

  const nextId = () => {
    const own = idFrom(seq++);
    return stack.length ? `${stack[stack.length - 1]}-${own}` : own;
  };

  const startLog = (id: string, label: string) => {
    if (!silent()) console.log(`[${scope}:${id}] ... ${label}`);
  };
  const successLog = (id: string, ms: number, printable: any, action: any) => {
    if (silent()) return;
    const max = Number(action?.maxResultLength ?? opts.maxResultLength ?? globalMaxResultLength);
    const rendered = compact(printable, max);
    const line = `[${scope}:${id}] ··· ${ms.toFixed(2)}ms${rendered ? ` → ${rendered}` : ""}`;
    if (Number(action?.budget) && ms > Number(action.budget)) console.warn(line + ` (over budget ${action.budget}ms)`);
    else console.log(line);
  };
  const errorLog = (id: string, ms: number, error: any) => {
    if (!silent()) console.error(`[${scope}:${id}] !!! ${ms.toFixed(2)}ms`, error);
  };

  async function measure(action: MeasureAction, fn?: () => any) {
    if (!fn) {
      const id = nextId();
      if (!silent()) console.log(`[${scope}:${id}] = ${labelOf(action)}`);
      return undefined;
    }
    const id = nextId();
    const label = labelOf(action);
    const t0 = now();
    startLog(id, label);
    stack.push(id);
    try {
      let p = Promise.resolve().then(fn);
      const timeout = typeof action === "object" ? Number(action.timeout || 0) : 0;
      if (timeout > 0) {
        p = Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeout}ms: ${label}`)), timeout)),
        ]);
      }
      const result = await p;
      stack.pop();
      const ms = now() - t0;
      const printable = typeof action === "object" && action?.end ? safeCall(() => action.end!(result), undefined) : result;
      successLog(id, ms, printable, action);
      return result;
    } catch (error) {
      stack.pop();
      const ms = now() - t0;
      errorLog(id, ms, error);
      if (typeof action === "object" && action?.catch) return action.catch(error);
      throw error;
    }
  }

  function measureSync(action: MeasureAction, fn?: () => any) {
    if (!fn) {
      const id = nextId();
      if (!silent()) console.log(`[${scope}:${id}] = ${labelOf(action)}`);
      return undefined;
    }
    const id = nextId();
    const label = labelOf(action);
    const t0 = now();
    startLog(id, label);
    stack.push(id);
    try {
      const result = fn();
      stack.pop();
      const ms = now() - t0;
      const printable = typeof action === "object" && action?.end ? safeCall(() => action.end!(result), undefined) : result;
      successLog(id, ms, printable, action);
      return result;
    } catch (error) {
      stack.pop();
      const ms = now() - t0;
      errorLog(id, ms, error);
      if (typeof action === "object" && action?.catch) return action.catch(error);
      throw error;
    }
  }

  measure.note = (message: string) => { if (!silent()) console.log(`[${scope}:note] ${message}`); };
  measureSync.note = measure.note;
  measure.timed = async (action: MeasureAction, fn: () => any) => {
    const t0 = now();
    const result = await measure(action, fn);
    return { result, duration: now() - t0 };
  };
  measureSync.timed = (action: MeasureAction, fn: () => any) => {
    const t0 = now();
    const result = measureSync(action, fn);
    return { result, duration: now() - t0 };
  };
  measure.wrap = (action: MeasureAction, fn: (...args: any[]) => any) => (...args: any[]) => measure(action, () => fn(...args));

  return { measure, measureSync };
}