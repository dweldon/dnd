import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { ClientMessage } from '../messages';

export type Send = (msg: ClientMessage) => void;

export const art = (path: string) => `/art/${path}`;

export const button =
  'rounded border border-amber-500 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:border-stone-700 disabled:bg-transparent disabled:text-stone-500';

export function Panel({
  title,
  className = '',
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-stone-700 bg-stone-900/80 p-3 ${className}`}
    >
      <h2 className="mb-3 font-pixel text-[10px] text-amber-300 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Portrait({
  src,
  size,
  down = false,
}: {
  src: string;
  size: number;
  down?: boolean;
}) {
  return (
    <img
      src={art(src)}
      alt=""
      width={size}
      height={size}
      className={`pixel shrink-0 self-start rounded border border-stone-700 bg-stone-800 ${down ? 'opacity-50 grayscale' : ''}`}
    />
  );
}

export function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const color = pct <= 33 ? 'bg-red-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded bg-stone-700">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs text-stone-400 tabular-nums">
        {hp}/{max}
      </span>
    </div>
  );
}

// Two clicks so nobody resets the game by accident
export function ResetButton({ send }: { send: Send }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);
  return (
    <button
      type="button"
      className={`rounded border px-2 py-1 text-xs ${confirm ? 'border-red-500 bg-red-500/20 text-red-200' : 'border-stone-700 text-stone-400 hover:text-stone-200'}`}
      onClick={() => {
        if (confirm) send({ type: 'reset' });
        setConfirm(!confirm);
      }}
    >
      {confirm ? 'Really reset?' : 'Reset game'}
    </button>
  );
}

// Keeps a scrolling list pinned to its newest entry
export function useScrollToEnd(last: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && last !== undefined) el.scrollTop = el.scrollHeight;
  }, [last]);
  return ref;
}
