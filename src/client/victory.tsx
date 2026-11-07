import { CHARACTERS, type Character } from '../game/characters';
import { VICTORY } from '../game/story';
import type { View } from '../game/view';
import { button, Portrait, type Send } from './ui';

export function Victory({ view, send }: { view: View; send: Send }) {
  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6 pt-16 text-center">
      <h1 className="font-pixel text-2xl text-amber-300 sm:text-3xl">
        Victory!
      </h1>
      <div className="flex flex-wrap justify-center gap-4">
        {view.players.map((p) => {
          const c: Character = CHARACTERS[p.characterId];
          return (
            <div key={p.characterId} className="w-28 space-y-1">
              <div className="flex justify-center">
                <Portrait src={c.portrait} size={96} />
              </div>
              <div className="text-sm">{p.name}</div>
            </div>
          );
        })}
      </div>
      <p className="text-lg leading-relaxed text-stone-300">{VICTORY}</p>
      <button
        type="button"
        className={button}
        onClick={() => send({ type: 'reset' })}
      >
        Play again
      </button>
    </main>
  );
}
