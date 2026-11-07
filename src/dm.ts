import type { CharacterId } from './game/characters';
import { type Action, act, type Dir, type GameState } from './game/engine';
import type { ItemId } from './game/items';
import { VICTORY } from './game/story';

const HELP =
  'Try: move <north|south|east|west>, attack [target], cast <ability> [target], search, use <item> [target], revive <hero>, or skip.';

const DIRS = ['north', 'south', 'east', 'west'];

// Placeholder parser until the AI DM (step 5) takes over
function parse(text: string): Action | null {
  const [verb, a, b] = text.trim().toLowerCase().split(/\s+/);
  switch (verb) {
    case 'move':
    case 'go':
      return a && DIRS.includes(a) ? { type: 'move', dir: a as Dir } : null;
    case 'attack':
      return { type: 'attack', target: a };
    case 'cast':
    case 'ability':
      return a ? { type: 'ability', ability: a, target: b } : null;
    case 'search':
      return { type: 'search' };
    case 'use':
      return a ? { type: 'use', item: a as ItemId, target: b } : null;
    case 'revive':
      return a ? { type: 'revive', target: a as CharacterId } : null;
    case 'skip':
      return { type: 'skip' };
    default:
      return null;
  }
}

// Answers the active player's chat, resolving any action through the engine
export function respond(
  state: GameState,
  token: string,
  text: string,
): Promise<void> {
  const say = (line: string) => state.chat.push({ from: 'DM', text: line });
  const action = parse(text);
  const result = action ? act(state, token, action) : null;
  if (!result) {
    say(HELP);
  } else if (!result.ok) {
    say(result.error);
  } else {
    say(result.lines.join(' '));
    for (const line of result.narration) say(line);
    if (state.phase === 'won') say(VICTORY);
  }
  return Promise.resolve();
}
