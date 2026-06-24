export type Equality<T> = (a: T, b: T) => boolean;
export type Unsubscribe = () => void;

type SelectorListener<T extends Record<string, any>, V> = {
  selector: (state: Readonly<T>) => V;
  callback: (value: V, prev: V) => void;
  equals: Equality<V>;
  value: V;
};

const sameValue = Object.is as Equality<any>;

export class MicroStore<T extends Record<string, any>> {
  private state: T;
  private keyListeners = new Map<keyof T, Set<(value: any, prev: any) => void>>();
  private selectorListeners = new Set<SelectorListener<T, any>>();
  private batching = 0;
  private pendingPrev = new Map<keyof T, any>();

  constructor(initial: T) { this.state = { ...initial }; }
  get<K extends keyof T>(key: K): T[K] { return this.state[key]; }
  snapshot(): Readonly<T> { return this.state; }
  set<K extends keyof T>(key: K, value: T[K]) {
    const prev = this.state[key];
    if (Object.is(prev, value)) return;
    if (this.batching && !this.pendingPrev.has(key)) this.pendingPrev.set(key, prev);
    this.state[key] = value;
    if (!this.batching) this.flush(new Map([[key, prev]]));
  }
  patch(values: Partial<T>) {
    this.batching++;
    try { for (const [k, v] of Object.entries(values)) this.set(k as keyof T, v as T[keyof T]); }
    finally { this.batching--; }
    if (!this.batching && this.pendingPrev.size) { const pending = this.pendingPrev; this.pendingPrev = new Map(); this.flush(pending); }
  }
  subscribeKey<K extends keyof T>(key: K, callback: (value: T[K], prev: T[K]) => void, immediate = true): Unsubscribe {
    let set = this.keyListeners.get(key);
    if (!set) { set = new Set(); this.keyListeners.set(key, set); }
    set.add(callback as any);
    if (immediate) callback(this.state[key], this.state[key]);
    return () => set!.delete(callback as any);
  }
  subscribe<V>(selector: (state: Readonly<T>) => V, callback: (value: V, prev: V) => void, options: { immediate?: boolean; equals?: Equality<V> } = {}): Unsubscribe {
    const listener: SelectorListener<T, V> = { selector, callback, equals: options.equals || sameValue, value: selector(this.state) };
    this.selectorListeners.add(listener as SelectorListener<T, any>);
    if (options.immediate !== false) callback(listener.value, listener.value);
    return () => this.selectorListeners.delete(listener as SelectorListener<T, any>);
  }
  bindText<K extends keyof T>(key: K, el: HTMLElement | null, format: (value: T[K]) => string = (v) => String(v ?? "")): Unsubscribe {
    if (!el) return () => {};
    return this.subscribeKey(key, (value) => { const next = format(value); if (el.textContent !== next) el.textContent = next; });
  }
  bindStyle<K extends keyof T>(key: K, el: HTMLElement | null, prop: keyof CSSStyleDeclaration, format: (value: T[K]) => string): Unsubscribe {
    if (!el) return () => {};
    return this.subscribeKey(key, (value) => { const next = format(value); if ((el.style as any)[prop] !== next) (el.style as any)[prop] = next; });
  }
  private flush(prevByKey: Map<keyof T, any>) {
    for (const [key, prev] of prevByKey) this.keyListeners.get(key)?.forEach((cb) => cb(this.state[key], prev));
    for (const listener of this.selectorListeners) {
      const prev = listener.value;
      const next = listener.selector(this.state);
      if (!listener.equals(prev, next)) { listener.value = next; listener.callback(next, prev); }
    }
  }
}
