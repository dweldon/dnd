import { alive, exits, type GameState, hero, key, roomAt } from './engine';
import { MONSTERS } from './monsters';

// What one player may see: no tokens, no fogged tiles, no secret doors
export function view(state: GameState, token: string) {
  const room = roomAt(state.pos);
  return {
    phase: state.phase,
    you: state.players.find((p) => p.token === token)?.characterId ?? null,
    turn: state.players[state.turn]?.characterId ?? null,
    turnEndsAt: state.turnEndsAt,
    pos: state.pos,
    exits: state.phase === 'playing' ? exits(state) : [],
    players: state.players.map((p) => ({
      characterId: p.characterId,
      name: p.name,
      hp: p.hp,
      maxHp: hero(p).maxHp,
      cooldowns: p.cooldowns,
      items: p.items,
      bonus: p.bonus,
    })),
    // ' ' is unrevealed
    map: state.tiles.map((row, y) =>
      row
        .map((t, x) => {
          if (!state.revealed.has(key({ x, y }))) return ' ';
          return t === 'S' ? '#' : t;
        })
        .join(''),
    ),
    room: room
      ? {
          name: room.name,
          description: room.description,
          hint: room.hint ?? null,
          riddle: state.rooms[room.id]?.solved
            ? null
            : (room.riddle?.question ?? null),
          monsters: alive(state).map((m) => ({
            id: m.id,
            name: m.name,
            hp: m.hp,
            maxHp: MONSTERS[m.type].maxHp,
            art: MONSTERS[m.type].art,
            stunned: m.stunned,
          })),
        }
      : null,
    log: state.log.slice(-50),
    chat: state.chat.slice(-100),
  };
}

export type View = ReturnType<typeof view>;
