import { memo } from 'react';
import type { Dir } from '../game/engine';
import type { View } from '../game/view';
import { art, type Send } from './ui';

const TILE = 18;
const TILE_ART: Record<string, string> = {
  '.': 'tiles/floor.svg',
  '#': 'tiles/wall.svg',
  '+': 'tiles/door.svg',
};

// Viewport diameter: the current room plus the edges of its neighbors
const VIEW = 20 * TILE;

// Circular window centered on the party, fading into the fog
// Memoized: the draft re-renders Game on every keystroke
export const DungeonMap = memo(function DungeonMap({ view }: { view: View }) {
  const width = (view.map[0]?.length ?? 0) * TILE;
  const height = view.map.length * TILE;
  const cell = (x: number, y: number) => ({
    left: x * TILE,
    top: y * TILE,
    width: TILE,
    height: TILE,
  });
  const dx = VIEW / 2 - (view.marker.x + 0.5) * TILE;
  const dy = VIEW / 2 - (view.marker.y + 0.5) * TILE;
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-full bg-black"
      style={{
        width: VIEW,
        height: VIEW,
        maskImage:
          'radial-gradient(circle closest-side, black 55%, transparent 100%)',
      }}
    >
      <div
        className="absolute top-0 left-0 bg-black transition-transform duration-500"
        style={{ width, height, transform: `translate(${dx}px, ${dy}px)` }}
      >
        {view.map.flatMap((row, y) =>
          [...row].map((t, x) => {
            const src = TILE_ART[t];
            return src ? (
              <img
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
                key={`${x},${y}`}
                src={art(src)}
                alt=""
                className="pixel absolute"
                style={cell(x, y)}
              />
            ) : null;
          }),
        )}
        {view.tints.map(({ rect, color }) => (
          <div
            key={`${rect.x},${rect.y}`}
            className="pointer-events-none absolute"
            style={{
              ...cell(rect.x, rect.y),
              width: rect.w * TILE,
              height: rect.h * TILE,
              background: `radial-gradient(ellipse at center, ${color} 0%, transparent 75%)`,
              mixBlendMode: 'soft-light',
              opacity: 0.6,
            }}
          />
        ))}
        {view.room?.monsters.map((m) => (
          <img
            key={m.id}
            src={art(m.art)}
            alt={m.name}
            title={m.name}
            className="pixel absolute drop-shadow-[0_0_4px_rgba(239,68,68,0.9)]"
            style={cell(m.x, m.y)}
          />
        ))}
        <img
          src={art('token.svg')}
          alt="Party"
          className="pixel absolute drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]"
          style={cell(view.marker.x, view.marker.y)}
        />
      </div>
    </div>
  );
});

const DIRS: { dir: Dir; label: string; area: string }[] = [
  { dir: 'north', label: 'N', area: 'col-start-2 row-start-1' },
  { dir: 'west', label: 'W', area: 'col-start-1 row-start-2' },
  { dir: 'east', label: 'E', area: 'col-start-3 row-start-2' },
  { dir: 'south', label: 'S', area: 'col-start-2 row-start-3' },
];

// Lit directions are open; clicking one sends a move on your turn
export function Compass({
  view,
  canAct,
  send,
}: {
  view: View;
  canAct: boolean;
  send: Send;
}) {
  return (
    <div className="mx-auto grid w-fit grid-cols-3 grid-rows-3 place-items-center gap-1">
      <img
        src={art('compass.svg')}
        alt="Compass"
        width={48}
        height={48}
        className="pixel col-start-2 row-start-2"
      />
      {DIRS.map(({ dir, label, area }) => {
        const open = view.exits.includes(dir);
        return (
          <button
            key={dir}
            type="button"
            title={`move ${dir}`}
            disabled={!open || !canAct}
            onClick={() => send({ type: 'chat', text: `move ${dir}` })}
            className={`${area} size-9 rounded border font-pixel text-xs ${
              open
                ? 'border-amber-500 text-amber-300 enabled:hover:bg-amber-500/25'
                : 'border-stone-800 text-stone-700'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
