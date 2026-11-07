import Anthropic from '@anthropic-ai/sdk';
import type { CharacterId } from './game/characters';
import { type Action, act, type Dir, type GameState } from './game/engine';
import type { ItemId } from './game/items';
import { VICTORY } from './game/story';
import { SYSTEM, snapshot, TOOLS } from './prompt';

const MODEL = 'claude-sonnet-5-5';

const HELP =
  'Try: move <north|south|east|west>, attack [target], cast <ability> [target], search, interact, answer <words>, use <item> [target], revive <hero>, or skip.';

const DIRS = ['north', 'south', 'east', 'west'];

const { ANTHROPIC_KEY } = process.env;
const client = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

type Messages = Anthropic.Beta.BetaMessageParam[];
type ActResult = { lines: string[]; narration: string[] };

// Keyword parser used without an API key or when the AI fails
function parse(text: string): Action | null {
  const [verb, a, b, ...rest] = text.trim().toLowerCase().split(/\s+/);
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
    case 'interact':
      return { type: 'interact' };
    case 'answer':
      return a ? { type: 'answer', answer: [a, b, ...rest].join(' ') } : null;
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

// One stateless call on the cached tools + system prefix; null on error or refusal
async function ask(
  messages: Messages,
  toolChoice: Anthropic.Beta.BetaToolChoice,
) {
  if (!client) return null;
  const started = Date.now();
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        {
          type: 'text',
          text: SYSTEM,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      tools: TOOLS,
      tool_choice: toolChoice,
      messages,
    });
    const u = res.usage;
    console.log(
      `DM ${res.stop_reason} ${Date.now() - started}ms: in ${u.input_tokens}, cache write ${u.cache_creation_input_tokens}, cache read ${u.cache_read_input_tokens}, out ${u.output_tokens}`,
    );
    return res.stop_reason === 'refusal' ? null : res;
  } catch (e) {
    if (!(e instanceof Anthropic.APIError)) throw e;
    console.error(`DM error ${e.status}: ${e.message}`);
    return null;
  }
}

const textOf = (res: Anthropic.Beta.BetaMessage | null) =>
  (res?.content ?? [])
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join(' ')
    .trim();

// Answers the active player's chat, resolving any action through the engine
export async function respond(state: GameState, token: string, text: string) {
  const say = (line: string) => state.chat.push({ from: 'DM', text: line });
  const report = (result: ActResult, story: string) => {
    say(story || result.lines.join(' '));
    for (const line of result.narration) say(line);
    if (state.phase === 'won') say(VICTORY);
  };

  const player = state.players[state.turn];
  if (!player) return;
  const prompt: Messages = [
    {
      role: 'user',
      content: `State: ${snapshot(state, player)}\n\n${player.name}'s player says: ${text}`,
    },
  ];
  const reply = await ask(prompt, {
    type: 'auto',
    disable_parallel_tool_use: true,
  });

  if (!reply) {
    const action = parse(text);
    const result = action ? act(state, token, action) : null;
    if (!result) return say(HELP);
    if (!result.ok) return say(result.error);
    return report(result, '');
  }

  const call = reply.content.find((b) => b.type === 'tool_use');
  // No tool call: a free answer, and the turn stays
  if (!call) return say(textOf(reply) || HELP);

  // Tool names and inputs mirror Action; the engine validates them
  const action = { ...(call.input as object), type: call.name } as Action;
  const result = act(state, token, action);
  if (!result.ok) return say(result.error);
  if (action.type === 'skip') return report(result, '');

  const narration = await ask(
    [
      ...prompt,
      { role: 'assistant', content: reply.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: call.id,
            content: `Results: ${result.lines.join(' | ')}\n\nState now: ${snapshot(state, player, false)}`,
          },
        ],
      },
    ],
    { type: 'none' },
  );
  report(result, textOf(narration));
}
