import { useSyncExternalStore } from 'react';

// On/off preference saved per browser
function setting(key: string) {
  let value = (() => {
    try {
      return localStorage.getItem(key) !== '0';
    } catch {
      return true;
    }
  })();
  const listeners = new Set<() => void>();
  const get = () => value;
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const set = (on: boolean) => {
    value = on;
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {}
    for (const cb of listeners) cb();
  };
  const use = () => [useSyncExternalStore(subscribe, get), set] as const;
  return { get, set, subscribe, use };
}

export const soundOn = setting('sound-on');
export const speechOn = setting('speech-on');
