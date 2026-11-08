import {
  CHARACTERS,
  type Character,
  type CharacterId,
} from '../game/characters';
import { TITLE } from '../game/story';
import type { View } from '../game/view';
import {
  button,
  describeEffect,
  Portrait,
  ResetButton,
  type Send,
  Tooltip,
  useSecretReset,
} from './ui';

const IDS = Object.keys(CHARACTERS) as CharacterId[];

// Character picker; also used to join a game already in progress
export function Lobby({
  view,
  error,
  send,
}: {
  view: View;
  error: string | null;
  send: Send;
}) {
  const playing = view.phase === 'playing';
  const joined = view.players.length;
  const reset = useSecretReset();
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: hidden reset gesture */}
          <h1
            className="font-pixel text-lg text-amber-300 select-none sm:text-2xl"
            onClick={reset.onClick}
          >
            {TITLE}
          </h1>
          <p className="mt-3 text-stone-400">
            {playing
              ? 'An adventure is in progress. Pick a free hero to join in.'
              : 'Pick a hero. Once 2 or more have joined, anyone can start.'}
          </p>
        </div>
        {reset.shown && <ResetButton send={send} />}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {IDS.map((id) => {
          const c: Character = CHARACTERS[id];
          const mine = view.you === id;
          const taken = view.players.some((p) => p.characterId === id);
          return (
            <button
              key={id}
              type="button"
              disabled={taken || Boolean(view.you)}
              onClick={() => send({ type: 'join', characterId: id })}
              className={`flex gap-3 rounded-lg border p-3 text-left transition ${
                mine
                  ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50'
                  : taken
                    ? 'border-stone-800 opacity-40'
                    : 'border-stone-700 bg-stone-900 enabled:hover:border-amber-500'
              }`}
            >
              <Portrait src={c.portrait} size={80} />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {(mine || taken) && (
                    <span className="rounded bg-stone-700 px-1.5 text-[10px] uppercase">
                      {mine ? 'You' : 'Taken'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-200/80">
                  {c.race} {c.className} · HP {c.maxHp} · AC {c.ac}
                </div>
                <p className="text-xs text-stone-400">{c.blurb}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-stone-500">
                  {c.abilities.map((a) => (
                    <Tooltip
                      key={a.id}
                      title={a.name}
                      text={a.description}
                      stats={[
                        ...describeEffect(a.effect),
                        `Usable every ${a.cooldown + 1} turns`,
                      ]}
                      className="underline decoration-dotted underline-offset-2 hover:text-stone-300"
                    >
                      {a.name}
                    </Tooltip>
                  ))}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {!playing && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className={button}
            disabled={!view.you || joined < 2}
            onClick={() => send({ type: 'start' })}
          >
            Start adventure
          </button>
          <p className="text-sm text-stone-400">
            {joined
              ? `Joined: ${view.players.map((p) => p.name).join(', ')}`
              : 'Nobody has joined yet.'}
            {joined < 2 && ' (need at least 2)'}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </main>
  );
}
