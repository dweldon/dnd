import { type MouseEvent, memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHARACTERS } from '../game/characters';
import type { Dir } from '../game/engine';
import type { View } from '../game/view';
import { art } from './ui';

const TILE = 18;
const TILE_ART: Record<string, string> = {
  '.': 'tiles/floor.svg',
  '#': 'tiles/wall.svg',
  '+': 'tiles/door.svg',
  F: 'tiles/secret-door.svg',
};

// Viewport diameter: the current room plus the edges of its neighbors
const VIEW = 20 * TILE;

// One row up to 3, else split into two rows of at most 3
function partyRows<T>(players: T[]) {
  if (players.length <= 3) return [players];
  const top = Math.ceil(players.length / 2);
  return [players.slice(0, top), players.slice(top)];
}

type Zoom = { src: string; label: string; x: number; top: number };

// Enlarged art floating above a hovered map sprite
// Portaled to body so the map's mask and transform don't clip it
function ZoomCard({ src, label, x, top: tileTop }: Zoom) {
  const size = 96;
  // Centered on the cursor, kept roughly inside the viewport
  const left = Math.min(Math.max(x, 64), window.innerWidth - 64);
  const top = Math.max(8, tileTop - size - 44);
  return createPortal(
    <div
      className="zoom-in pointer-events-none fixed z-40 flex -translate-x-1/2 flex-col items-center gap-1 rounded-lg border border-amber-500/40 bg-stone-900/95 p-2 shadow-xl shadow-black/60"
      style={{ left, top }}
    >
      <img src={src} alt="" width={size} height={size} className="pixel" />
      <span className="font-pixel text-[8px] text-amber-300 capitalize">
        {label}
      </span>
    </div>,
    document.body,
  );
}

// Circular window centered on the party, fading into the fog
// Shrinks to fit narrow screens, showing less of the dungeon
// Memoized: the draft re-renders Game on every keystroke
const DungeonMap = memo(function DungeonMap({ view }: { view: View }) {
  const width = (view.map[0]?.length ?? 0) * TILE;
  const height = view.map.length * TILE;
  const cell = (x: number, y: number) => ({
    left: x * TILE,
    top: y * TILE,
    width: TILE,
    height: TILE,
  });
  const [zoom, setZoom] = useState<Zoom | null>(null);
  // Sprites move under a still cursor when the view changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on view
  useEffect(() => setZoom(null), [view]);
  const hover = (src: string, label: string) => ({
    onMouseEnter: (e: MouseEvent) =>
      setZoom({
        src,
        label,
        x: e.clientX,
        top: e.currentTarget.getBoundingClientRect().top,
      }),
    onMouseLeave: () => setZoom(null),
  });
  const dx = -(view.marker.x + 0.5) * TILE;
  const dy = -(view.marker.y + 0.5) * TILE;
  return (
    <>
      {zoom && <ZoomCard {...zoom} />}
      <div
        className="relative mx-auto overflow-hidden rounded-full bg-black"
        style={{
          width: VIEW,
          maxWidth: '100%',
          aspectRatio: '1',
          maskImage:
            'radial-gradient(circle closest-side, black 55%, transparent 100%)',
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 bg-black transition-transform duration-500"
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
          {view.props.map((p) => (
            <img
              key={`${p.x},${p.y}`}
              src={art(p.art)}
              alt=""
              className="pixel absolute"
              style={cell(p.x, p.y)}
              {...hover(
                art(p.art),
                p.art.replace(/^props\/|\.svg$/g, '').replaceAll('-', ' '),
              )}
            />
          ))}
          {view.room?.monsters.map((m) => (
            <img
              key={m.id}
              src={art(m.art)}
              alt={m.name}
              className="pixel absolute drop-shadow-[0_0_4px_rgba(239,68,68,0.9)]"
              style={cell(m.x, m.y)}
              {...hover(art(m.art), m.name)}
            />
          ))}
          {/* Party: overlapping avatars centered on the marker tile */}
          <div
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]"
            style={{
              left: (view.marker.x + 0.5) * TILE,
              top: (view.marker.y + 0.5) * TILE,
            }}
          >
            {partyRows(view.players).map((row, r) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
                key={r}
                className={`flex ${r ? '-mt-1.5' : ''}`}
              >
                {row.map((p, i) => (
                  <img
                    key={p.characterId}
                    src={art(CHARACTERS[p.characterId].portrait)}
                    alt={p.name}
                    {...hover(art(CHARACTERS[p.characterId].portrait), p.name)}
                    className={`pixel pointer-events-auto size-4 rounded-full border border-amber-400 bg-stone-800 ${i ? '-ml-1.5' : ''} ${p.hp === 0 ? 'opacity-60 grayscale' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
});

const DIRS: { dir: Dir; label: string; pos: string }[] = [
  { dir: 'north', label: 'N', pos: 'top-0 left-1/2 -translate-x-1/2' },
  { dir: 'west', label: 'W', pos: 'top-1/2 left-0 -translate-y-1/2' },
  { dir: 'east', label: 'E', pos: 'top-1/2 right-0 -translate-y-1/2' },
  { dir: 'south', label: 'S', pos: 'bottom-0 left-1/2 -translate-x-1/2' },
];

// Map with direction buttons on its rim; lit ones are open
// Buttons hide on small screens where there's no room around the map
export function Compass({
  view,
  act,
}: {
  view: View;
  act: (text: string) => void;
}) {
  return (
    <div className="relative mx-auto w-fit max-w-full sm:p-9">
      <DungeonMap view={view} />
      {DIRS.map(({ dir, label, pos }) => {
        const open = view.exits.includes(dir);
        return (
          <button
            key={dir}
            type="button"
            title={`move ${dir}`}
            disabled={!open}
            onClick={() => act(`move ${dir}`)}
            className={`absolute ${pos} hidden size-7 rounded border bg-stone-900/90 font-pixel text-[10px] sm:block ${
              open
                ? 'border-amber-500 text-amber-300 enabled:hover:bg-amber-900'
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
