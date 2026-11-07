import type { Dir } from '../game/engine';
import type { View } from '../game/view';
import { art, type Send } from './ui';

const TILE = 18;
const TILE_ART: Record<string, string> = {
  '.': 'tiles/floor.svg',
  '#': 'tiles/wall.svg',
  '+': 'tiles/door.svg',
};

// Revealed tiles plus the party token; fog is plain black
export function DungeonMap({ view }: { view: View }) {
  const width = (view.map[0]?.length ?? 0) * TILE;
  const height = view.map.length * TILE;
  const cell = (x: number, y: number) => ({
    left: x * TILE,
    top: y * TILE,
    width: TILE,
    height: TILE,
  });
  return (
    <div className="overflow-auto">
      <div className="relative bg-black" style={{ width, height }}>
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
        <img
          src={art('token.svg')}
          alt="Party"
          className="pixel absolute drop-shadow-[0_0_4px_rgba(251,191,36,0.9)] transition-all duration-500"
          style={cell(view.pos.x, view.pos.y)}
        />
      </div>
    </div>
  );
}

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
    <div className="grid w-fit grid-cols-3 grid-rows-3 place-items-center gap-1">
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
