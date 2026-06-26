// @ts-nocheck
/**
 * Canvas-world safe sound facade.
 *
 * The old makeSfx lived in client/meshes.ts, which was tied to the Three.js
 * world bundle.  Keep the page-level API the same while moving audio into a
 * renderer-independent module.
 */
export type SolcraftSfx = ReturnType<typeof makeSfx>;

function audioContext(): AudioContext | null {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    const w = window as any;
    if (!w.__solcraftAudioCtx) w.__solcraftAudioCtx = new Ctx();
    return w.__solcraftAudioCtx as AudioContext;
  } catch {
    return null;
  }
}

function tone(freq = 440, ms = 80, type: OscillatorType = "sine", gain = 0.035, slide = 1) {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), ctx.currentTime);
    if (slide && slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), ctx.currentTime + ms / 1000);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000 + 0.02);
  } catch {}
}

function makeEvent(uiMutedRef: () => boolean, freq: number, ms: number, type: OscillatorType = "square", gain = 0.035, slide = 1) {
  return () => { if (!uiMutedRef()) tone(freq, ms, type, gain, slide); };
}

export function makeSfx() {
  let uiMuted = false;
  let musicMuted = false;
  let musicUrl = "";
  let music: HTMLAudioElement | null = null;
  let audioConfig: any = {};
  const isUiMuted = () => !!uiMuted;

  function ensureMusic() {
    if (!music && typeof Audio !== "undefined") {
      music = new Audio();
      music.loop = true;
      music.preload = "none";
    }
    return music;
  }

  function applyMusicPrefs() {
    const el = ensureMusic();
    if (!el) return;
    const vol = Number(audioConfig?.musicVolume ?? 0.72);
    el.volume = Math.max(0, Math.min(1, vol));
    el.muted = !!musicMuted;
    if (musicUrl && el.src !== musicUrl) el.src = musicUrl;
  }

  return {
    setUiMuted(v: any) { uiMuted = !!v; },
    setMusicMuted(v: any) { musicMuted = !!v; applyMusicPrefs(); if (musicMuted) music?.pause?.(); },
    setAudioConfig(v: any) { audioConfig = v || {}; applyMusicPrefs(); },
    setMusicUrl(url: string) { musicUrl = String(url || ""); applyMusicPrefs(); },
    resume() { try { audioContext()?.resume?.(); applyMusicPrefs(); if (!musicMuted && musicUrl) music?.play?.().catch(() => {}); } catch {} },
    coin() { if (!uiMuted) { tone(880, 55, "square", 0.035); setTimeout(() => tone(1320, 70, "square", 0.028), 45); } },
    build: makeEvent(isUiMuted, 180, 120, "sawtooth", 0.05, 0.55),
    err: makeEvent(isUiMuted, 180, 130, "square", 0.04, 0.65),
    hit: makeEvent(isUiMuted, 130, 75, "triangle", 0.045, 0.6),
    raid: makeEvent(isUiMuted, 95, 120, "sawtooth", 0.05, 0.5),
    milestone() { if (!uiMuted) { tone(660, 70, "triangle", 0.035); setTimeout(() => tone(990, 90, "triangle", 0.03), 70); } },
    hop: makeEvent(isUiMuted, 360, 45, "sine", 0.018, 1.08),
    saw: makeEvent(isUiMuted, 170, 70, "sawtooth", 0.035, 0.65),
    chop: makeEvent(isUiMuted, 150, 70, "triangle", 0.04, 0.62),
    claim: makeEvent(isUiMuted, 420, 80, "triangle", 0.035, 1.25),
    demolish: makeEvent(isUiMuted, 80, 180, "sawtooth", 0.055, 0.45),
  };
}
