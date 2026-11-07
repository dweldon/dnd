import { createRoot } from 'react-dom/client';
import { Game } from './game';
import { Lobby } from './lobby';
import { useGame } from './use-game';
import { Victory } from './victory';

function App() {
  const { view, thinking, error, send } = useGame();
  if (!view) {
    return <p className="p-6 font-pixel text-xs text-stone-400">Connecting…</p>;
  }
  if (view.phase === 'won') return <Victory view={view} send={send} />;
  if (view.phase === 'lobby' || !view.you) {
    return <Lobby view={view} error={error} send={send} />;
  }
  return <Game view={view} thinking={thinking} error={error} send={send} />;
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
