import { alive, exits, type GameState, hero, key, roomAt } from './engine';
import { ROOMS } from './map';
import { MONSTERS } from './monsters';

// What one player may see: no tokens, no fogged tiles, no secret doors
export function view(state: GameState, token: string) {
  const room = roomAt(state.pos);
  return {
    phase: state.phase,
    you: state.players.find((p) => p.token === token)?.characterId ?? null,
    turn: state.players[state.turn]?.characterId ?? null,
    turnEndsAt: state.turnEndsAt,
    // Where to draw the party: room center, else the corridor tile
    marker: room
      ? {
          x: room.rect.x + (room.rect.w - 1) / 2,
          y: room.rect.y + (room.rect.h - 1) / 2,
        }
      : state.pos,
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
    // Entering a room reveals its whole rect, so one tile tells us
    tints: ROOMS.filter(
      (r) => r.tint && state.revealed.has(key({ x: r.rect.x, y: r.rect.y })),
    ).map((r) => ({ rect: r.rect, color: r.tint as string })),
    room: room
      ? {
          name: room.name,
          description: room.description,
          hint: room.hint ?? null,
          riddle: state.rooms[room.id]?.solved
            ? null
            : (room.riddle?.question ?? null),
          // Display-only spots, spread along the room's top floor row
          monsters: alive(state).map((m, i, all) => ({
            x:
              room.rect.x +
              Math.floor(((i + 1) * room.rect.w) / (all.length + 1)),
            y: room.rect.y,
            id: m.id,
            name: m.name,
            hp: m.hp,
            maxHp: m.maxHp,
            art: MONSTERS[m.type].art,
            stunned: m.stunned,
          })),
        }
      : null,
    chat: state.chat.slice(-100),
  };
}

export type View = ReturnType<typeof view>;
