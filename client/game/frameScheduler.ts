// @ts-nocheck
export type FrameTask = {
  name: string;
  everyMs: number;
  lastRun: number;
  active: boolean;
  run: (now: number, dt: number) => void;
  cancel: () => void;
};

export type FrameScheduler = {
  every: (name: string, everyMs: number, run: (now: number, dt: number) => void, opts?: { immediate?: boolean }) => FrameTask;
  cancel: (task: FrameTask | null | undefined) => void;
  clear: () => void;
  size: () => number;
};

export function createFrameScheduler(): FrameScheduler {
  const tasks = new Set<FrameTask>();
  let raf = 0;
  let lastFrame = 0;

  const ensure = () => {
    if (!raf && tasks.size) raf = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    raf = 0;
    const frameDt = lastFrame ? Math.max(0, now - lastFrame) : 0;
    lastFrame = now;
    for (const task of Array.from(tasks)) {
      if (!task.active) { tasks.delete(task); continue; }
      const due = !task.lastRun || now - task.lastRun >= task.everyMs;
      if (!due) continue;
      const dt = task.lastRun ? now - task.lastRun : frameDt;
      task.lastRun = now;
      try { task.run(now, dt); } catch (e) { console.error(`[frameScheduler:${task.name}]`, e); }
    }
    ensure();
  };

  function cancel(task: FrameTask | null | undefined) {
    if (!task) return;
    task.active = false;
    tasks.delete(task);
    if (!tasks.size && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  return {
    every(name, everyMs, run, opts = {}) {
      const task: FrameTask = {
        name,
        everyMs: Math.max(0, Number(everyMs || 0)),
        lastRun: opts.immediate === false ? performance.now() : 0,
        active: true,
        run,
        cancel: () => cancel(task),
      };
      tasks.add(task);
      ensure();
      return task;
    },
    cancel,
    clear() {
      for (const task of Array.from(tasks)) task.active = false;
      tasks.clear();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    size: () => tasks.size,
  };
}
