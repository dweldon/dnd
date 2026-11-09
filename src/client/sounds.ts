import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Sound } from '../game/engine';
import type { View } from '../game/view';

const MUTE_KEY = 'muted';
const GAP = 0.15;
const VOLUME = 0.15;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let nextAt = 0;

// Browsers only allow audio after a user gesture
function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Shared with speech
export const audio = () => ctx;
export const isMuted = () => muted;

// Gain envelope: quick attack, exponential decay
function envelope(c: AudioContext, t: number, dur: number, gain: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master as GainNode);
  return g;
}

function tone(
  t: number,
  freq: number,
  dur: number,
  type: OscillatorType = 'triangle',
  gain = 1,
  slideTo?: number,
) {
  const c = ctx as AudioContext;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  osc.connect(envelope(c, t, dur, gain));
  osc.start(t);
  osc.stop(t + dur);
}

function noise(
  t: number,
  dur: number,
  gain: number,
  freq: number,
  type: BiquadFilterType = 'lowpass',
) {
  const c = ctx as AudioContext;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  src.connect(filter).connect(envelope(c, t, dur, gain));
  src.start(t);
  src.stop(t + dur);
}

const SOUNDS: Record<Sound, (t: number) => void> = {
  turn: (t) => tone(t, 880, 0.3, 'sine'),
  hit: (t) => {
    noise(t, 0.08, 1, 1500);
    tone(t, 180, 0.1, 'square', 0.5, 80);
  },
  miss: (t) => noise(t, 0.18, 0.5, 2500, 'highpass'),
  defeat: (t) => {
    tone(t, 300, 0.2, 'sawtooth', 0.5, 60);
    tone(t + 0.18, 660, 0.08);
    tone(t + 0.26, 990, 0.15);
  },
  hurt: (t) => {
    tone(t, 120, 0.2, 'sine', 1.5, 50);
    noise(t, 0.1, 0.8, 400);
  },
  // Soft rising shimmer
  heal: (t) => {
    tone(t, 523, 0.5, 'sine', 0.6, 1047);
    [784, 988, 1175].forEach((f, i) => {
      tone(t + 0.08 + i * 0.08, f, 0.3, 'sine', 0.3);
    });
  },
  down: (t) => {
    tone(t, 440, 0.18);
    tone(t + 0.16, 370, 0.18);
    tone(t + 0.32, 294, 0.4);
  },
  secret: (t) => {
    noise(t, 0.5, 0.6, 300);
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(t + 0.1 + i * 0.07, f, 0.2, 'triangle', 0.7);
    });
  },
  loot: (t) => {
    tone(t, 1319, 0.1, 'square', 0.3);
    tone(t + 0.08, 1760, 0.2, 'square', 0.3);
  },
  equip: (t) => {
    noise(t, 0.04, 0.5, 4000, 'highpass');
    tone(t, 1200, 0.15, 'triangle', 0.6);
    tone(t, 1810, 0.25, 'sine', 0.4);
  },
  combat: (t) => {
    tone(t, 90, 0.35, 'sine', 1.5, 50);
    noise(t, 0.2, 0.8, 200);
  },
  calm: (t) => {
    for (const f of [392, 494, 587]) tone(t, f, 0.7, 'sine', 0.5);
  },
  victory: (t) => {
    tone(t, 523, 0.15);
    tone(t + 0.15, 659, 0.15);
    tone(t + 0.3, 784, 0.15);
    for (const f of [1047, 784, 659]) tone(t + 0.45, f, 1, 'triangle', 0.5);
  },
};

// Queued so batched events don't play on top of each other
function play(cue: Sound) {
  if (ctx?.state !== 'running' || muted) return;
  const t = Math.max(ctx.currentTime, nextAt);
  nextAt = t + GAP;
  SOUNDS[cue](t);
}

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();
export const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useMuted() {
  const value = useSyncExternalStore(subscribe, isMuted);
  const toggle = () => {
    muted = !muted;
    // Also silences sounds already queued
    if (master) master.gain.value = muted ? 0 : VOLUME;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {}
    for (const cb of listeners) cb();
  };
  return [value, toggle] as const;
}

// Plays new events from each view
export function useSounds(view: View | null) {
  const lastId = useRef<number | null>(null);
  const events = view?.events;
  const you = view?.you;

  useEffect(() => {
    if (!events) return;
    const newest = events.at(-1)?.id ?? -1;
    // First view or a reset: skip what's already there
    if (lastId.current === null || newest < lastId.current) {
      lastId.current = newest;
      return;
    }
    for (const e of events) {
      if (e.id <= lastId.current) continue;
      if (!e.to || e.to === you) play(e.sound);
    }
    lastId.current = newest;
  }, [events, you]);
}
