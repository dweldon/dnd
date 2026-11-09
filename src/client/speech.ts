import { useEffect, useRef } from 'react';
import type { View } from '../game/view';
import { speechOn } from './settings';
import { audio } from './sounds';

const VOLUME = 0.9;
// The API has no speaking rate; an audio element keeps pitch when sped up
const RATE = 1.2;

// Clips fetch in parallel but play strictly in order
let queue = Promise.resolve();
let stop: (() => void) | null = null;
// Bumped on reset so the old game's queued lines are dropped
let epoch = 0;

// Only the newest actions are spoken so speech keeps up with play;
// combat lines only from the newest one
const KEEP = 2;
let newest = 0;

// Held while the tour is up so the DM doesn't talk over it
let gate = Promise.resolve();

// Turning speech off stops the line in progress
speechOn.subscribe(() => {
  if (!speechOn.get()) stop?.();
});

// Queued lines wait until release is called
export function holdSpeech() {
  let release = () => {};
  gate = new Promise((r) => {
    release = r;
  });
  return release;
}

// Pinned lines play even when their action is stale
function say(text: string, batch: number, pinned: boolean, combat: boolean) {
  // Same gesture unlock as sound effects
  if (audio()?.state !== 'running' || !speechOn.get()) return;
  const clip = fetch(`/speech?text=${encodeURIComponent(text)}`)
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);
  const mine = epoch;
  queue = queue.then(async () => {
    const blob = await clip;
    await gate;
    if (!pinned && batch <= newest - (combat ? 1 : KEEP)) return;
    if (!blob || !speechOn.get() || mine !== epoch) return;
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.volume = VOLUME;
    el.playbackRate = RATE;
    await new Promise<void>((done) => {
      stop = () => {
        el.pause();
        done();
      };
      el.onended = el.onerror = () => done();
      el.play().catch(() => done());
    });
    stop = null;
    URL.revokeObjectURL(url);
  });
}

// Reads new DM lines aloud
export function useSpeech(view: View | null, voice: boolean) {
  const lastTotal = useRef<number | null>(null);
  const chat = view?.chat;
  const total = view?.chatTotal;

  useEffect(() => {
    if (!chat || total === undefined) return;
    const last = lastTotal.current;
    lastTotal.current = total;
    // A reset silences the old game
    if (last !== null && total < last) {
      epoch++;
      stop?.();
    }
    // First view or a reset: skip what's already there
    if (last === null || total <= last || !voice) return;
    const lines = chat.slice(-Math.min(total - last, chat.length));
    // One update holds one action's lines; player chat doesn't count
    if (!lines.some((m) => m.from === 'DM')) return;
    const batch = ++newest;
    const first = total - lines.length;
    // The intro is always line 0
    lines.forEach((m, i) => {
      if (m.from === 'DM') say(m.text, batch, first + i === 0, !!m.combat);
    });
  }, [chat, total, voice]);
}
