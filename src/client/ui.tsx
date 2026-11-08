import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Effect } from '../game/types';
import type { ClientMessage } from '../messages';

export type Send = (msg: ClientMessage) => void;

export const art = (path: string) => `/art/${path}`;

export const button =
  'rounded border border-amber-500 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:border-stone-700 disabled:bg-transparent disabled:text-stone-500';

export function Panel({
  title,
  id,
  className = '',
  children,
}: {
  title: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-lg border border-stone-700 bg-stone-900/80 p-3 ${className}`}
    >
      <h2 className="mb-3 font-pixel text-[10px] text-amber-300 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Counts HP drops so a flash can replay on each hit
function useHits(hp: number | undefined) {
  const prev = useRef(hp);
  const [hits, setHits] = useState(0);
  useEffect(() => {
    if (hp !== undefined && prev.current !== undefined && hp < prev.current) {
      setHits((h) => h + 1);
    }
    prev.current = hp;
  }, [hp]);
  return hits;
}

export function Portrait({
  src,
  size,
  hp,
}: {
  src: string;
  size: number;
  hp?: number;
}) {
  const hits = useHits(hp);
  return (
    <img
      key={hits}
      src={art(src)}
      alt=""
      width={size}
      height={size}
      className={`pixel shrink-0 self-start rounded border border-stone-700 bg-stone-800 ${hp === 0 ? 'opacity-50 grayscale' : ''} ${hits ? 'hurt-flash' : ''}`}
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

// Plain-English stat lines for an ability or item effect
export function describeEffect(effect: Effect): string[] {
  switch (effect.kind) {
    case 'damage':
      return [
        `Damage ${effect.dice}`,
        effect.area === 'all' ? 'Hits every enemy' : 'One enemy',
        effect.autoHit ? 'Never misses' : '',
        effect.stun ? 'Stuns: target skips its next action' : '',
      ].filter(Boolean);
    case 'heal':
      return [
        `Heals ${effect.dice} HP`,
        { self: 'Yourself', one: 'You or one ally', party: 'Whole party' }[
          effect.area
        ],
      ];
    case 'weaken':
      return [`Target -${effect.ac} AC for the rest of the fight`];
    case 'equip': {
      const parts = [
        effect.ac && `+${effect.ac} AC`,
        effect.attack && `+${effect.attack} to hit`,
        effect.damage && `+${effect.damage} damage`,
      ].filter(Boolean);
      return [`Permanent: ${parts.join(', ')}`];
    }
  }
}

const GAP = 8;

// Floating info card shown while hovering the trigger.
// Fixed position so scrolling columns can't clip it.
export function Tooltip({
  title,
  icon,
  text,
  stats,
  className = '',
  children,
  onDragStart,
  ...rest
}: {
  title: string;
  icon?: string;
  text?: string;
  stats: string[];
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<'span'>, 'title'>) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // Place right of the trigger, flipping left and clamping to the viewport
  useLayoutEffect(() => {
    const el = card.current;
    if (!rect || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const right = rect.right + GAP;
    const left =
      right + width <= window.innerWidth ? right : rect.left - width - GAP;
    const top = Math.min(rect.top, window.innerHeight - height - GAP);
    el.style.left = `${Math.max(GAP, left)}px`;
    el.style.top = `${Math.max(GAP, top)}px`;
  }, [rect]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only info card
    <span
      {...rest}
      className={className}
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      onDragStart={(e) => {
        setRect(null);
        onDragStart?.(e);
      }}
    >
      {children}
      {rect && (
        <div
          ref={card}
          className="tooltip pointer-events-none fixed z-40 w-64 rounded-lg border border-amber-500/40 bg-stone-900 p-3 text-left font-sans text-xs font-normal normal-case shadow-xl shadow-black/60"
        >
          <div className="flex items-center gap-2">
            {icon && (
              <img
                src={art(icon)}
                alt=""
                width={24}
                height={24}
                className="pixel"
              />
            )}
            <span className="font-pixel text-[10px] leading-relaxed text-amber-300">
              {title}
            </span>
          </div>
          {text && <p className="mt-2 text-stone-400 italic">{text}</p>}
          <ul className="mt-2 space-y-1 border-t border-stone-700 pt-2">
            {stats.map((s) => (
              <li key={s} className="flex gap-1.5 text-amber-100">
                <span className="text-amber-400">◆</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
