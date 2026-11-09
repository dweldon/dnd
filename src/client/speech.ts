import { useEffect, useRef } from 'react';
import type { View } from '../game/view';
import { audio, isMuted, subscribe } from './sounds';

const VOLUME = 0.9;
// The API has no speaking rate; an audio element keeps pitch when sped up
const RATE = 1.2;

// Clips fetch in parallel but play strictly in order
let queue = Promise.resolve();
let stop: (() => void) | null = null;
// Bumped on reset so the old game's queued lines are dropped
let epoch = 0;

// Muting stops the line in progress
subscribe(() => {
  if (isMuted()) stop?.();
});

function say(text: string) {
  // Same gesture unlock as sound effects
  if (audio()?.state !== 'running' || isMuted()) return;
  const clip = fetch(`/speech?text=${encodeURIComponent(text)}`)
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);
  const mine = epoch;
  queue = queue.then(async () => {
    const blob = await clip;
    if (!blob || isMuted() || mine !== epoch) return;
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
    for (const m of chat.slice(-Math.min(total - last, chat.length))) {
      if (m.from === 'DM') say(m.text);
    }
  }, [chat, total, voice]);
}
