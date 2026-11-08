import { CHARACTERS, type Character, type CharacterId } from './characters';
import { d20, pick, roll } from './dice';
import { ITEMS, type Item, type ItemId } from './items';
import { ROOMS, type Room, START, TILES, type Tile } from './map';
import { MONSTERS, type Monster, type MonsterId } from './monsters';
import { WIPE } from './story';
import type { Dice, Effect, Pos } from './types';

export const TURN_MS = 120_000;

export type Player = {
  token: string;
  // The hero's name
  name: string;
  characterId: CharacterId;
  hp: number;
  // Turns until each ability is usable again
  cooldowns: Record<string, number>;
  items: ItemId[];
  bonus: { ac: number; attack: number; damage: number };
};

export type MonsterState = {
  id: string;
  type: MonsterId;
  name: string;
  hp: number;
  acPenalty: number;
  stunned: boolean;
};

export type GameState = {
  phase: 'lobby' | 'playing' | 'won';
  players: Player[];
  turn: number;
  turnEndsAt: number;
  pos: Pos;
  // Copy of TILES; a found secret door becomes '+'
  tiles: Tile[][];
  revealed: Set<string>;
  rooms: Record<
    string,
    { monsters: MonsterState[]; loot: ItemId[]; used: boolean; solved: boolean }
  >;
  // Where the party wakes after a wipe
  lastSafe: Pos;
  // Compact actions list
  log: string[];
  // DM log, written by the server
  chat: { from: string; text: string }[];
};

export type Dir = 'north' | 'south' | 'east' | 'west';

export type Action =
  | { type: 'move'; dir: Dir }
  | { type: 'attack'; target?: string }
  | { type: 'ability'; ability: string; target?: string }
  | { type: 'search' }
  | { type: 'interact' }
  | { type: 'answer'; answer: string }
  | { type: 'use'; item: ItemId; target?: string }
  | { type: 'revive'; target: CharacterId }
  | { type: 'skip' };

type Fail = { ok: false; error: string };

const DIRS: Record<Dir, Pos> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

class GameError extends Error {}

function fail(message: string): never {
  throw new GameError(message);
}

export const key = (p: Pos) => `${p.x},${p.y}`;
const add = (a: Pos, b: Pos): Pos => ({ x: a.x + b.x, y: a.y + b.y });
const tileAt = (state: GameState, p: Pos) => state.tiles[p.y]?.[p.x] ?? '#';
const isOpen = (state: GameState, p: Pos) =>
  ['.', '+'].includes(tileAt(state, p));

export const hero = (p: Player): Character => CHARACTERS[p.characterId];
const kind = (m: MonsterState): Monster => MONSTERS[m.type];

export const roomAt = (p: Pos) =>
  ROOMS.find(
    ({ rect: r }) =>
      p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h,
  );

// Living monsters in the party's room
export function alive(state: GameState) {
  const room = roomAt(state.pos);
  const monsters = room ? state.rooms[room.id]?.monsters : undefined;
  return monsters?.filter((m) => m.hp > 0) ?? [];
}

export function newGame(): GameState {
  const rooms: GameState['rooms'] = {};
  for (const room of ROOMS) {
    rooms[room.id] = {
      monsters: spawn(room),
      loot: [...room.loot],
      used: false,
      solved: false,
    };
  }
  return {
    phase: 'lobby',
    players: [],
    turn: 0,
    turnEndsAt: 0,
    pos: { ...START },
    tiles: TILES.map((row) => [...row]),
    revealed: new Set(),
    rooms,
    lastSafe: { ...START },
    log: [],
    chat: [],
  };
}

// Numbers duplicates, e.g. 'goblin-2' / 'Goblin 2'
function spawn(room: Room): MonsterState[] {
  return room.monsters.map((type, i) => {
    const m: Monster = MONSTERS[type];
    const total = room.monsters.filter((t) => t === type).length;
    const n = room.monsters.slice(0, i + 1).filter((t) => t === type).length;
    return {
      id: total > 1 ? `${type}-${n}` : type,
      type,
      name: total > 1 ? `${m.name} ${n}` : m.name,
      hp: m.maxHp,
      acPenalty: 0,
      stunned: false,
    };
  });
}

export function join(
  state: GameState,
  characterId: string,
): { ok: true; token: string } | Fail {
  if (!Object.hasOwn(CHARACTERS, characterId)) {
    return { ok: false, error: 'Unknown character.' };
  }
  if (state.phase === 'won') return { ok: false, error: 'The game is over.' };
  if (state.players.some((p) => p.characterId === characterId)) {
    return { ok: false, error: 'That character is taken.' };
  }
  const id = characterId as CharacterId;
  const c: Character = CHARACTERS[id];
  const token = crypto.randomUUID();
  state.players.push({
    token,
    name: c.name,
    characterId: id,
    hp: c.maxHp,
    cooldowns: {},
    items: [...c.items],
    bonus: { ac: 0, attack: 0, damage: 0 },
  });
  if (state.phase === 'playing') state.log.push(`${c.name} joins the party.`);
  return { ok: true, token };
}

export function start(state: GameState): { ok: true } | Fail {
  if (state.phase !== 'lobby') {
    return { ok: false, error: 'The game has started.' };
  }
  if (state.players.length < 2) {
    return { ok: false, error: 'At least 2 players are needed.' };
  }
  state.phase = 'playing';
  state.turn = 0;
  state.turnEndsAt = Date.now() + TURN_MS;
  enter(state);
  return { ok: true };
}

// Resolves the active player's action and ends their turn
export function act(
  state: GameState,
  token: string,
  action: Action,
): { ok: true; lines: string[]; narration: string[] } | Fail {
  const player = state.players[state.turn];
  if (state.phase !== 'playing' || player?.token !== token) {
    return { ok: false, error: "It's not your turn." };
  }
  const from = state.log.length;
  const fighting = alive(state).length > 0;
  try {
    resolve(state, player, action);
  } catch (e) {
    if (e instanceof GameError) return { ok: false, error: e.message };
    throw e;
  }
  if (fighting && !alive(state).length && state.phase === 'playing') {
    endCombat(state, player);
  }
  const lines = state.log.slice(from);
  return { ok: true, lines, narration: endTurn(state) };
}

// Auto-skips the active player after TURN_MS
export function tick(state: GameState, now: number): string[] | null {
  const player = state.players[state.turn];
  if (state.phase !== 'playing' || !player || now < state.turnEndsAt) {
    return null;
  }
  state.log.push(`${player.name}'s turn timed out.`);
  return endTurn(state);
}

function resolve(state: GameState, player: Player, action: Action) {
  const c = hero(player);
  switch (action.type) {
    case 'move':
      move(state, player, action.dir);
      break;
    case 'attack':
      strike(state, player, target(state, action.target), 'attacks', {
        dice: c.attack.damage,
      });
      break;
    case 'ability': {
      const ability =
        c.abilities.find((a) => a.id === action.ability) ??
        fail(`${c.name} doesn't know that ability.`);
      const wait = player.cooldowns[ability.id] ?? 0;
      if (wait > 0) {
        fail(`${ability.name} is ready in ${wait} turn${wait > 1 ? 's' : ''}.`);
      }
      applyEffect(state, player, ability.effect, action.target, ability.name);
      player.cooldowns[ability.id] = ability.cooldown + 1;
      break;
    }
    case 'search':
      search(state, player);
      break;
    case 'interact': {
      const { room, rs } = here(state);
      if (!room.feature || rs.used) fail("There's nothing to use here.");
      applyEffect(
        state,
        player,
        room.feature.effect,
        undefined,
        room.feature.name,
      );
      rs.used = true;
      break;
    }
    case 'answer':
      answer(state, player, action.answer);
      break;
    case 'use': {
      const i = player.items.indexOf(action.item);
      if (i < 0) fail("You don't have that item.");
      const item: Item = ITEMS[action.item];
      applyEffect(state, player, item.effect, action.target, item.name);
      player.items.splice(i, 1);
      break;
    }
    case 'revive': {
      const ally = state.players.find((p) => p.characterId === action.target);
      if (!ally || ally.hp > 0) fail('Only a downed ally can be revived.');
      const hp = heal(ally, roll(c.reviveHeal));
      state.log.push(`${player.name} revives ${ally.name}: +${hp} HP`);
      break;
    }
    case 'skip':
      state.log.push(`${player.name} skips.`);
      break;
    default:
      fail('Unknown action.');
  }
}

// Auto-walks through a door and along the corridor until a room, junction or dead end
function move(state: GameState, player: Player, dir: Dir) {
  const d = DIRS[dir] ?? fail('Unknown direction.');
  if (alive(state).length) fail("You can't leave while enemies block the way!");
  const room = roomAt(state.pos);
  let cur = room ? exitOf(state, room, d) : add(state.pos, d);
  if (!cur || !isOpen(state, cur)) fail(`There's no way ${dir} from here.`);
  let prev = { x: cur.x - d.x, y: cur.y - d.y };
  state.log.push(`${player.name} leads the party ${dir}.`);
  for (let i = 0; i < 100; i++) {
    state.pos = cur;
    revealAround(state, cur);
    if (roomAt(cur)) return enter(state, player);
    const next = Object.values(DIRS)
      .map((o) => add(cur as Pos, o))
      .filter((p) => isOpen(state, p) && key(p) !== key(prev));
    const [only] = next;
    if (next.length !== 1 || !only) return;
    prev = cur;
    cur = only;
  }
}

// Directions the party can move from here
export function exits(state: GameState): Dir[] {
  const room = roomAt(state.pos);
  return (Object.keys(DIRS) as Dir[]).filter((dir) => {
    const p = room ? exitOf(state, room, DIRS[dir]) : add(state.pos, DIRS[dir]);
    return p !== undefined && isOpen(state, p);
  });
}

// The open door on one side of a room
function exitOf(state: GameState, room: Room, d: Pos) {
  const { x, y, w, h } = room.rect;
  const side = d.x
    ? Array.from({ length: h }, (_, i) => ({
        x: d.x > 0 ? x + w : x - 1,
        y: y + i,
      }))
    : Array.from({ length: w }, (_, i) => ({
        x: x + i,
        y: d.y > 0 ? y + h : y - 1,
      }));
  return side.find((p) => tileAt(state, p) === '+');
}

function revealAround(state: GameState, p: Pos) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      state.revealed.add(key({ x: p.x + dx, y: p.y + dy }));
    }
  }
}

function enter(state: GameState, player?: Player) {
  const room = roomAt(state.pos);
  if (!room) return;
  const { x, y, w, h } = room.rect;
  for (let ry = y - 1; ry <= y + h; ry++) {
    for (let rx = x - 1; rx <= x + w; rx++)
      state.revealed.add(key({ x: rx, y: ry }));
  }
  // Line of sight down each corridor, stopping at the far door
  for (const d of Object.values(DIRS)) {
    const door = exitOf(state, room, d);
    if (!door) continue;
    for (let p = add(door, d); isOpen(state, p) && !roomAt(p); p = add(p, d)) {
      if (tileAt(state, p) === '+') {
        state.revealed.add(key(p));
        break;
      }
      revealAround(state, p);
    }
  }
  if (room.safe) {
    state.lastSafe = { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) };
  }
  state.log.push(`The party enters ${room.name}.`, room.description);
  // Hint only while the secret door is undiscovered
  if (room.hint && room.secret && tileAt(state, room.secret.door) === 'S') {
    state.log.push(room.hint);
  }
  const foes = alive(state);
  if (foes.length) {
    state.log.push(`Combat! ${foes.map((m) => m.name).join(', ')}`);
  } else if (player) {
    loot(state, player);
  }
}

function loot(state: GameState, player: Player) {
  const room = roomAt(state.pos);
  const items = room ? state.rooms[room.id]?.loot : undefined;
  if (!items?.length) return;
  player.items.push(...items);
  const names = items.map((i) => ITEMS[i].name).join(', ');
  state.log.push(`${player.name} finds ${names}.`);
  items.length = 0;
}

function target(state: GameState, id?: string): MonsterState {
  const foes = alive(state);
  const m = id ? foes.find((f) => f.id === id) : foes[0];
  return (
    m ??
    fail(foes.length ? 'No such enemy here.' : 'There are no enemies here.')
  );
}

function ally(state: GameState, player: Player, id?: string): Player {
  if (!id) return player;
  return (
    state.players.find((p) => p.characterId === id) ?? fail('No such ally.')
  );
}

function heal(p: Player, amount: number) {
  const gained = Math.min(amount, hero(p).maxHp - p.hp);
  p.hp += gained;
  return gained;
}

function strike(
  state: GameState,
  player: Player,
  m: MonsterState,
  verb: string,
  hit: { dice: Dice; autoHit?: boolean; stun?: boolean },
) {
  const who = `${player.name} ${verb} ${m.name}`;
  const toHit = d20() + hero(player).attack.bonus + player.bonus.attack;
  if (!hit.autoHit && toHit < kind(m).ac - m.acPenalty) {
    state.log.push(`${who}: miss`);
    return;
  }
  const dmg = Math.max(0, roll(hit.dice) + player.bonus.damage);
  m.hp = Math.max(0, m.hp - dmg);
  const stunned = Boolean(hit.stun) && m.hp > 0;
  m.stunned ||= stunned;
  state.log.push(`${who}: hit, ${dmg} dmg${stunned ? ', stunned' : ''}`);
  if (m.hp > 0) return;
  state.log.push(`${m.name} is defeated!`);
  if (kind(m).boss) {
    state.phase = 'won';
    state.log.push('Victory! The coffee pot is saved!');
  }
}

function applyEffect(
  state: GameState,
  player: Player,
  effect: Effect,
  targetId: string | undefined,
  label: string,
) {
  switch (effect.kind) {
    case 'damage': {
      const foes =
        effect.area === 'all' ? alive(state) : [target(state, targetId)];
      if (!foes.length) fail('There are no enemies here.');
      for (const m of foes)
        strike(state, player, m, `uses ${label} on`, effect);
      break;
    }
    case 'heal': {
      const allies =
        effect.area === 'party'
          ? state.players
          : effect.area === 'self'
            ? [player]
            : [ally(state, player, targetId)];
      const gains = allies.map(
        (a) => `${a.name} +${heal(a, roll(effect.dice))}`,
      );
      state.log.push(`${player.name} uses ${label}: ${gains.join(', ')} HP`);
      break;
    }
    case 'weaken': {
      const m = target(state, targetId);
      m.acPenalty += effect.ac;
      state.log.push(
        `${player.name} uses ${label} on ${m.name}: AC -${effect.ac}`,
      );
      break;
    }
    case 'equip':
      player.bonus.ac += effect.ac ?? 0;
      player.bonus.attack += effect.attack ?? 0;
      player.bonus.damage += effect.damage ?? 0;
      state.log.push(`${player.name} equips ${label}.`);
      break;
  }
}

function search(state: GameState, player: Player) {
  const n = d20() + hero(player).searchBonus;
  const secret = roomAt(state.pos)?.secret;
  const row = secret && state.tiles[secret.door.y];
  if (secret && row?.[secret.door.x] === 'S' && n >= secret.dc) {
    row[secret.door.x] = '+';
    state.revealed.add(key(secret.door));
    state.log.push(
      `${player.name} searches (rolled ${n}): found a secret door!`,
    );
  } else {
    state.log.push(`${player.name} searches (rolled ${n}): nothing found.`);
  }
}

// The party's room and its state
function here(state: GameState) {
  const room = roomAt(state.pos) ?? fail("You're in a corridor.");
  return { room, rs: state.rooms[room.id] as GameState['rooms'][string] };
}

function answer(state: GameState, player: Player, text: string) {
  const { room, rs } = here(state);
  const riddle = room.riddle;
  if (!riddle || rs.solved) fail("There's no riddle here.");
  const words =
    String(text ?? '')
      .toLowerCase()
      .match(/[a-z]+/g) ?? [];
  if (!words.some((w) => riddle.answers.includes(w))) {
    state.log.push(`${player.name} answers "${text}": wrong!`);
    return;
  }
  rs.solved = true;
  player.items.push(...riddle.reward);
  const names = riddle.reward.map((i) => ITEMS[i].name).join(', ');
  state.log.push(
    `${player.name} answers "${text}": correct! Reward: ${names}.`,
  );
}

function endCombat(state: GameState, player: Player) {
  const downed = state.players.filter((p) => p.hp === 0);
  for (const p of downed) p.hp = Math.floor(hero(p).maxHp / 2);
  state.log.push(
    downed.length ? 'Combat over! Downed heroes get back up.' : 'Combat over!',
  );
  loot(state, player);
}

// Advances to the next standing player; monsters act after the last player
function endTurn(state: GameState): string[] {
  const narration: string[] = [];
  for (let i = 0; i <= state.players.length * 2; i++) {
    if (state.phase !== 'playing') break;
    const current = state.players[state.turn];
    if (current) {
      for (const [id, n] of Object.entries(current.cooldowns)) {
        current.cooldowns[id] = Math.max(0, n - 1);
      }
    }
    state.turn++;
    if (state.turn >= state.players.length) {
      state.turn = 0;
      monsterPhase(state, narration);
    }
    if ((state.players[state.turn]?.hp ?? 0) > 0) break;
  }
  state.turnEndsAt = Date.now() + TURN_MS;
  return narration;
}

function monsterPhase(state: GameState, narration: string[]) {
  const say = (text: string) => {
    state.log.push(text);
    narration.push(text);
  };
  for (const m of alive(state)) {
    const t = kind(m);
    if (m.stunned) {
      m.stunned = false;
      say(`${m.name} is stunned and can't act.`);
      continue;
    }
    for (let i = 0; i < (t.attacks ?? 1); i++) {
      const standing = state.players.filter((p) => p.hp > 0);
      if (!standing.length) break;
      const p = pick(standing);
      const hit = d20() + t.attack.bonus >= hero(p).ac + p.bonus.ac;
      const dmg = hit ? roll(t.attack.damage) : 0;
      p.hp = Math.max(0, p.hp - dmg);
      state.log.push(
        `${m.name} attacks ${p.name}: ${hit ? `hit, ${dmg} dmg` : 'miss'}`,
      );
      narration.push(
        pick(hit ? t.hitLines : t.missLines)
          .replaceAll('{monster}', m.name)
          .replaceAll('{target}', p.name)
          .replaceAll('{damage}', String(dmg)),
      );
      if (p.hp === 0) say(`${p.name} is down!`);
    }
  }
  if (state.players.every((p) => p.hp === 0)) wipe(state, narration);
}

// Everyone is down: wake in the last safe room at full HP
function wipe(state: GameState, narration: string[]) {
  for (const p of state.players) {
    p.hp = hero(p).maxHp;
    p.cooldowns = {};
  }
  for (const m of alive(state)) {
    m.stunned = false;
    m.acPenalty = 0;
  }
  state.pos = { ...state.lastSafe };
  state.log.push(`The party wakes up in ${roomAt(state.pos)?.name}.`);
  narration.push(WIPE);
}
