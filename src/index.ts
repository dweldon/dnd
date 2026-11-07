import type { ServerWebSocket } from 'bun';
import index from './client/index.html';
import { respond } from './dm';
import { join, newGame, start, tick } from './game/engine';
import { INTRO } from './game/story';
import { view } from './game/view';
import type { ClientMessage, ServerMessage } from './messages';

type Socket = ServerWebSocket<{ token: string }>;

const { PORT, NODE_ENV } = process.env;
const ART = `${import.meta.dir}/client/art`;

let game = newGame();
// True while the DM handles a chat message
let thinking = false;
const sockets = new Set<Socket>();

const send = (ws: Socket, msg: ServerMessage) => ws.send(JSON.stringify(msg));
const sendState = (ws: Socket) =>
  send(ws, { type: 'state', view: view(game, ws.data.token), thinking });

function broadcast() {
  for (const ws of sockets) sendState(ws);
}

async function handle(ws: Socket, msg: ClientMessage) {
  const error = (text: string) => send(ws, { type: 'error', error: text });
  switch (msg.type) {
    case 'join': {
      const result = join(game, String(msg.characterId));
      if (!result.ok) return error(result.error);
      ws.data.token = result.token;
      send(ws, { type: 'token', token: result.token });
      break;
    }
    case 'start': {
      const result = start(game);
      if (!result.ok) return error(result.error);
      game.chat.push({ from: 'DM', text: INTRO });
      break;
    }
    case 'chat': {
      const player = game.players[game.turn];
      const text = String(msg.text ?? '')
        .trim()
        .slice(0, 500);
      if (game.phase !== 'playing' || player?.token !== ws.data.token) {
        return error("It's not your turn.");
      }
      if (thinking) return error('The DM is still thinking.');
      if (!text) return;
      game.chat.push({ from: player.name, text });
      thinking = true;
      broadcast();
      const current = game;
      try {
        await respond(current, ws.data.token, text);
      } finally {
        // A reset mid-call already cleared it
        if (game === current) thinking = false;
      }
      break;
    }
    case 'reset':
      game = newGame();
      thinking = false;
      break;
    default:
      return;
  }
  broadcast();
}

const server = Bun.serve({
  port: Number(PORT) || 3000,
  development: NODE_ENV !== 'production',
  routes: {
    '/ws': (req, server) => {
      const token = new URL(req.url).searchParams.get('token') ?? '';
      if (server.upgrade(req, { data: { token } })) return;
      return new Response('Upgrade failed', { status: 400 });
    },
    // pathname is normalized, so '..' can't escape the art dir
    '/art/*': async (req) => {
      const file = Bun.file(`${ART}${new URL(req.url).pathname.slice(4)}`);
      if (!(await file.exists()))
        return new Response('Not found', { status: 404 });
      return new Response(file);
    },
    '/*': index,
  },
  websocket: {
    data: {} as { token: string },
    open(ws) {
      sockets.add(ws);
      sendState(ws);
    },
    message(ws, raw) {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      handle(ws, msg).catch((e) => {
        console.error(e);
        broadcast();
      });
    },
    close(ws) {
      sockets.delete(ws);
    },
  },
});

// Auto-skips idle turns, but never mid-DM-call
setInterval(() => {
  if (thinking) return;
  const name = game.players[game.turn]?.name;
  const narration = tick(game, Date.now());
  if (!narration) return;
  game.chat.push({ from: 'DM', text: `${name}'s turn timed out.` });
  for (const text of narration) game.chat.push({ from: 'DM', text });
  broadcast();
}, 1000);

console.log(`Listening on ${server.url}`);
