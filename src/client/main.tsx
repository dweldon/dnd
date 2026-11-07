import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CHARACTERS } from '../game/characters';
import { useGame } from './use-game';

// Temporary debug screen until the real UI (step 7)
function App() {
  const { view, thinking, error, send } = useGame();
  const [text, setText] = useState('');
  if (!view) return <p className="p-4">Connecting…</p>;
  const button = 'rounded border px-2 py-1 disabled:opacity-40';
  return (
    <div className="space-y-4 p-4 font-mono text-sm">
      <div className="flex flex-wrap gap-2">
        {Object.entries(CHARACTERS).map(([id, c]) => (
          <button
            key={id}
            type="button"
            className={button}
            disabled={
              Boolean(view.you) ||
              view.players.some((p) => p.characterId === id)
            }
            onClick={() => send({ type: 'join', characterId: id })}
          >
            {c.name}
          </button>
        ))}
        <button
          type="button"
          className={button}
          onClick={() => send({ type: 'start' })}
        >
          Start
        </button>
        <button
          type="button"
          className={button}
          onClick={() => send({ type: 'reset' })}
        >
          Reset
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: 'chat', text });
          setText('');
        }}
      >
        <input
          className="w-full rounded border px-2 py-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={view.turn === view.you ? 'Your turn' : 'Waiting…'}
        />
      </form>
      {thinking && <p>DM is thinking…</p>}
      {error && <p className="text-red-600">{error}</p>}
      <pre>{JSON.stringify(view, null, 2)}</pre>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
