// Difficulty simulator: bots play full games on the pure engine (no DM)
// Usage: bun scripts/sim.ts [gamesPerParty] [partySize]
// Targets (6p mixed; 2–5p same danger/interaction, shorter is fine):
//   game 60–80 min (aim 75), wipe games < 5%, fights with a down ~25%,
//   ally actions/player/fight ~0.5
//   downs by fight: guard-post/slime-pools ~5–10%, crypt/mess-hall/antechamber ~20–30%, throne ~50%
import type { Ability, CharacterId } from '../src/game/characters';
import { parse, pick } from '../src/game/dice';
import {
  type Action,
  act,
  alive,
  type Dir,
  type GameState,
  hero,
  join,
  kind,
  type MonsterState,
  newGame,
  type Player,
  roomAt,
  start,
} from '../src/game/engine';
import { ITEMS, type Item, type ItemId } from '../src/game/items';
import { WIPE } from '../src/game/story';
import type { Dice } from '../src/game/types';

const GAMES = Number(process.argv[2]) || 500;
const SIZES = process.argv[3] ? [Number(process.argv[3])] : [2, 3, 4, 5, 6];
// Chance a sloppy bot wastes its turn
const SLOPPY_CHANCE = 0.2;
// Heal abilities target allies below this HP ratio
const HEAL_AT = 0.5;
// Potions are drunk / given below this HP ratio
const POTION_AT = 0.35;
const MAX_SEARCHES = 6;
const MAX_TURNS = 5000;
// Time model (guesses until a real 6-player run calibrates them)
const DECIDE_SEC = 30;
const LLM_SEC = 1.5;
// Extra per riddle for reading and discussing it
const RIDDLE_SEC = 60;

type Bot = 'good' | 'sloppy';
// 'mixed': ceil(size / 3) random sloppy seats, the rest good
type Profile = Bot | 'mixed';

// From `room`, go `dir`; a `secret` leg needs its hidden door found first
type Leg = { room: string; dir: Dir; secret?: boolean };

const ROUTE: Leg[] = [
  { room: 'entrance', dir: 'east' },
  { room: 'guard-post', dir: 'east' },
  { room: 'grotto', dir: 'east', secret: true },
  { room: 'pantry', dir: 'west' },
  { room: 'grotto', dir: 'north' },
  { room: 'slime-pools', dir: 'west' },
  { room: 'crypt', dir: 'west' },
  { room: 'shrine', dir: 'south', secret: true },
  { room: 'reliquary', dir: 'north' },
  { room: 'shrine', dir: 'north' },
  { room: 'mess-hall', dir: 'east' },
  { room: 'library', dir: 'south', secret: true },
  { room: 'supply-closet', dir: 'north' },
  { room: 'library', dir: 'east' },
  { room: 'antechamber', dir: 'east' },
  { room: 'waiting-room', dir: 'south' },
];

const OTHERS: CharacterId[] = [
  'fighter',
  'wizard',
  'thief',
  'barbarian',
  'ranger',
];

// `tried`: secret legs already searched or entered
type Nav = { leg: number; searches: number; tried: Set<number> };

type Fight = {
  room: string;
  rounds: number;
  downs: number;
  wiped: boolean;
  // Party HP ratio at the end (0 on a wipe)
  hp: number;
  // Ally-directed actions
  heals: number;
  revives: number;
  items: number;
  setups: number;
};

type Stats = {
  size: number;
  turns: number;
  combat: number;
  riddle: number;
  riddles: number;
  wipes: number;
  potionsUsed: number;
  potionsHad: number;
  ranOut: boolean;
  fights: Fight[];
};

const chance = (p: number) => Math.random() < p;
const ratio = (p: Player) => p.hp / hero(p).maxHp;
const ready = (p: Player, a: Ability) => !p.cooldowns[a.id];
const item = (id: ItemId): Item => ITEMS[id];

// Expected value of a dice string
function avg(dice: Dice) {
  const { count, sides, bonus } = parse(dice);
  return (count * (sides + 1)) / 2 + bonus;
}

const threat = (m: MonsterState) =>
  avg(kind(m).attack.damage) * (kind(m).attacks ?? 1);

function shuffle<T>(xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
  }
  return xs;
}

// Next leg from this room, or the last earlier one after a wipe
function legFor(room: string, from: number) {
  const next = ROUTE.findIndex((l, i) => i >= from && l.room === room);
  if (next >= 0) return next;
  const back = ROUTE.findLastIndex((l, i) => i < from && l.room === room);
  if (back < 0) throw new Error(`No route from ${room}`);
  return back;
}

const potions = (p: Player) =>
  p.items.filter((i) => item(i).effect?.kind === 'heal');

// Heal ability on low allies (party heal for 2+), or self-heal
function healAbility(state: GameState, p: Player): Action | undefined {
  const low = state.players
    .filter((a) => a.hp > 0 && ratio(a) < HEAL_AT)
    .sort((a, b) => ratio(a) - ratio(b));
  const heals = hero(p).abilities.filter(
    (a) => a.effect.kind === 'heal' && ready(p, a),
  );
  const area = (a: Ability) => a.effect.kind === 'heal' && a.effect.area;
  const party = heals.find((a) => area(a) === 'party');
  if (party && low.length >= 2) return { type: 'ability', ability: party.id };
  const one = heals.find((a) => area(a) === 'one');
  if (one && low[0]) {
    return { type: 'ability', ability: one.id, target: low[0].characterId };
  }
  const self = heals.find((a) => area(a) === 'self');
  if (self && ratio(p) < HEAL_AT) return { type: 'ability', ability: self.id };
  return undefined;
}

function combat(state: GameState, p: Player): Action {
  const foes = alive(state);
  const down = state.players.find((a) => a.hp === 0);
  if (down) return { type: 'revive', target: down.characterId };

  const heal = healAbility(state, p);
  if (heal) return heal;
  const [potion] = potions(p);
  const hurt = state.players
    .filter((a) => a.hp > 0 && ratio(a) < POTION_AT)
    .sort((a, b) => ratio(a) - ratio(b))[0];
  if (potion && hurt) {
    return { type: 'use', item: potion, target: hurt.characterId };
  }

  // Setup: weaken the toughest foe, stun the biggest threat
  const boss = foes.find((m) => kind(m).boss);
  if (boss && p.items.includes('decaf-dust')) {
    return { type: 'use', item: 'decaf-dust', target: boss.id };
  }
  const [tough] = foes.filter((m) => !m.acPenalty).sort((a, b) => b.hp - a.hp);
  const ready_ = hero(p).abilities.filter((a) => ready(p, a));
  const weaken = ready_.find((a) => a.effect.kind === 'weaken');
  if (weaken && tough) {
    return { type: 'ability', ability: weaken.id, target: tough.id };
  }
  const [scary] = foes
    .filter((m) => !m.stunned)
    .sort((a, b) => threat(b) - threat(a));
  const stun = ready_.find((a) => a.effect.kind === 'damage' && a.effect.stun);
  if (stun && scary) {
    return { type: 'ability', ability: stun.id, target: scary.id };
  }
  if (foes.length >= 2 && p.items.includes('fizzbang-bomb')) {
    return { type: 'use', item: 'fizzbang-bomb' };
  }

  // Focus the weakest foe with the best damage ability, else attack
  const [weakest] = [...foes].sort((a, b) => a.hp - b.hp);
  const value = (a: Ability) =>
    a.effect.kind === 'damage'
      ? avg(a.effect.dice) * (a.effect.area === 'all' ? foes.length : 1)
      : 0;
  const [best] = ready_
    .filter((a) => value(a) > 0)
    .sort((a, b) => value(b) - value(a));
  if (best) return { type: 'ability', ability: best.id, target: weakest?.id };
  return { type: 'attack', target: weakest?.id };
}

function explore(state: GameState, p: Player, nav: Nav, profile: Bot): Action {
  const room = roomAt(state.pos);
  if (!room) throw new Error('Lost in a corridor');
  const rs = state.rooms[room.id];

  const heal = healAbility(state, p);
  if (heal) return heal;

  const f = room.feature;
  if (f && !rs?.used) {
    const partyHeal = f.effect.kind === 'heal' && f.effect.area === 'party';
    const hurt = partyHeal
      ? state.players.some((a) => ratio(a) < 1)
      : ratio(p) < 1;
    if (hurt) return { type: 'interact' };
  }

  if (room.riddle && !rs?.solved) {
    const wrong = profile === 'sloppy' && chance(SLOPPY_CHANCE);
    return {
      type: 'answer',
      answer: wrong ? 'umm' : `${room.riddle.answers[0]}`,
    };
  }

  nav.leg = legFor(room.id, nav.leg);
  let leg = ROUTE[nav.leg] as Leg;
  if (leg.secret) {
    const door = room.secret?.door;
    const hidden = door && state.tiles[door.y]?.[door.x] === 'S';
    const tried = nav.tried.has(nav.leg);
    if (hidden && !tried && nav.searches < MAX_SEARCHES) {
      nav.searches++;
      return { type: 'search' };
    }
    nav.tried.add(nav.leg);
    // Enter a secret room once; skip it after giving up or on a revisit
    if (hidden || tried) {
      nav.leg = legFor(room.id, nav.leg + 1);
      leg = ROUTE[nav.leg] as Leg;
    }
  }
  nav.searches = 0;
  return { type: 'move', dir: leg.dir };
}

function choose(state: GameState, p: Player, nav: Nav, profile: Bot): Action {
  const fighting = alive(state).length > 0;
  if (profile === 'sloppy' && chance(SLOPPY_CHANCE)) {
    const foe = pick(alive(state));
    return fighting && chance(0.5)
      ? { type: 'attack', target: foe?.id }
      : { type: 'skip' };
  }
  return fighting ? combat(state, p) : explore(state, p, nav, profile);
}

const partyPotions = (state: GameState) =>
  state.players.reduce((n, p) => n + potions(p).length, 0);

const isSetup = (p: Player, action: Action, lines: string[]) => {
  if (action.type === 'use') return action.item === 'decaf-dust';
  if (action.type !== 'ability') return false;
  const e = hero(p).abilities.find((a) => a.id === action.ability)?.effect;
  if (e?.kind === 'weaken') return true;
  return e?.kind === 'damage' && lines.some((l) => l.endsWith(', stunned'));
};

const newFight = (room: string): Fight => ({
  room,
  rounds: 0,
  downs: 0,
  wiped: false,
  hp: 0,
  heals: 0,
  revives: 0,
  items: 0,
  setups: 0,
});

function play(party: CharacterId[], profile: Profile): Stats {
  const state = newGame();
  for (const id of shuffle([...party])) {
    const r = join(state, id);
    if (!r.ok) throw new Error(r.error);
  }
  const started = start(state);
  if (!started.ok) throw new Error(started.error);

  const sloppy = new Set(
    profile === 'mixed'
      ? shuffle([...party]).slice(0, Math.ceil(party.length / 3))
      : profile === 'sloppy'
        ? party
        : [],
  );
  const nav: Nav = { leg: 0, searches: 0, tried: new Set() };
  const stats: Stats = {
    size: party.length,
    turns: 0,
    combat: 0,
    riddle: 0,
    riddles: 0,
    wipes: 0,
    potionsUsed: 0,
    potionsHad: partyPotions(state),
    ranOut: false,
    fights: [],
  };
  const riddles = new Set<string>();
  let fight: Fight | undefined;
  // Monster id -> hero who set it up, until an ally hits it
  const setups = new Map<string, CharacterId>();

  while (state.phase !== 'won') {
    if (stats.turns >= MAX_TURNS) {
      throw new Error(`Stuck: ${party.join(',')} ${profile}`);
    }
    const p = state.players[state.turn] as Player;
    const room = roomAt(state.pos)?.id ?? '';
    const foes = alive(state);
    if (foes.length && !fight) {
      fight = newFight(room);
      setups.clear();
    }
    const foeHp = new Map(foes.map((m) => [m.id, m.hp]));
    const down = state.players.filter((a) => a.hp === 0);
    const turn = state.turn;
    const pots = partyPotions(state);

    const bot: Bot = sloppy.has(p.characterId) ? 'sloppy' : 'good';
    const action = choose(state, p, nav, bot);
    const r = act(state, p.token, action);
    if (!r.ok) {
      throw new Error(`${p.characterId} ${JSON.stringify(action)}: ${r.error}`);
    }
    stats.turns++;
    const drank =
      action.type === 'use' && item(action.item).effect?.kind === 'heal';
    if (drank) stats.potionsUsed++;
    stats.potionsHad += Math.max(0, partyPotions(state) - pots + +drank);
    if (stats.potionsUsed && !partyPotions(state)) stats.ranOut = true;
    if (r.narration.includes(WIPE)) stats.wipes++;

    if (!fight) {
      if (action.type === 'answer') {
        stats.riddle++;
        riddles.add(room);
      }
      continue;
    }
    stats.combat++;

    const self = p.characterId;
    if (action.type === 'revive') fight.revives++;
    if (drank && action.target && action.target !== self) fight.items++;
    if (action.type === 'ability') {
      const e = hero(p).abilities.find((a) => a.id === action.ability)?.effect;
      const other = action.target && action.target !== self;
      if (e?.kind === 'heal' && (e.area === 'party' || other)) fight.heals++;
    }
    for (const [id, by] of setups) {
      const m = state.rooms[room]?.monsters.find((f) => f.id === id);
      if (by !== self && m && m.hp < (foeHp.get(id) ?? 0)) {
        fight.setups++;
        setups.delete(id);
      }
    }
    const aimed = action.type === 'ability' || action.type === 'use';
    if (aimed && action.target && isSetup(p, action, r.lines)) {
      setups.set(action.target, self);
    }
    fight.downs += r.narration.filter((l) => l.endsWith(' is down!')).length;

    const wiped = r.narration.includes(WIPE);
    const won = (state.phase as GameState['phase']) === 'won';
    const ended = wiped || won || !alive(state).length;
    if (ended || state.turn <= turn) fight.rounds++;
    if (!ended) continue;
    const up = state.players.filter((a) => !down.includes(a));
    const max = state.players.reduce((n, a) => n + hero(a).maxHp, 0);
    fight.wiped = wiped;
    fight.hp = wiped ? 0 : up.reduce((n, a) => n + a.hp, 0) / max;
    stats.fights.push(fight);
    fight = undefined;
  }
  stats.riddles = riddles.size;
  return stats;
}

const minutes = (g: Stats) =>
  (g.turns * (DECIDE_SEC + LLM_SEC) + g.riddles * RIDDLE_SEC) / 60;

const ally = (f: Fight) => f.heals + f.revives + f.items + f.setups;

const mean = <T>(xs: T[], f: (x: T) => number) =>
  Number((xs.reduce((s, x) => s + f(x), 0) / (xs.length || 1)).toFixed(2));

// Danger and interaction columns for a set of fights
const fightCols = (fs: Fight[], size: number) => ({
  fights: fs.length,
  'wipe%': mean(fs, (f) => +f.wiped * 100),
  'down%': mean(fs, (f) => +(f.downs > 0) * 100),
  downs: mean(fs, (f) => f.downs),
  'hp%': mean(fs, (f) => f.hp * 100),
  rounds: mean(fs, (f) => f.rounds),
  'ally/p': mean(fs, (f) => ally(f) / size),
  heals: mean(fs, (f) => f.heals),
  revives: mean(fs, (f) => f.revives),
  items: mean(fs, (f) => f.items),
  setups: mean(fs, (f) => f.setups),
});

// Cleric plus every combination of the other classes
const parties = Array.from({ length: 2 ** OTHERS.length - 1 }, (_, i) => [
  'cleric' as CharacterId,
  ...OTHERS.filter((_, b) => (i + 1) & (1 << b)),
]);

const games: Record<string, Stats[]> = {};
for (const size of SIZES) {
  for (const profile of ['good', 'mixed', 'sloppy'] as Profile[]) {
    games[`${size}p ${profile}`] = parties
      .filter((p) => p.length === size)
      .flatMap((party) =>
        Array.from({ length: GAMES }, () => play(party, profile)),
      );
  }
}
const entries = Object.entries(games);

console.log(
  `Time: ${DECIDE_SEC}s decide + ${LLM_SEC}s LLM per turn, ${RIDDLE_SEC}s per riddle`,
);
console.table(
  Object.fromEntries(
    entries.map(([k, gs]) => [
      k,
      {
        games: gs.length,
        min: mean(gs, minutes),
        turns: mean(gs, (g) => g.turns),
        combat: mean(gs, (g) => g.combat),
        explore: mean(gs, (g) => g.turns - g.combat - g.riddle),
        riddle: mean(gs, (g) => g.riddle),
        wipes: mean(gs, (g) => g.wipes),
        'wipe games%': mean(gs, (g) => +(g.wipes > 0) * 100),
        'potions used': mean(gs, (g) => g.potionsUsed),
        'potions had': mean(gs, (g) => g.potionsHad),
        'ran out%': mean(gs, (g) => +g.ranOut * 100),
      },
    ]),
  ),
);

console.log('Per party size (all fights)');
console.table(
  Object.fromEntries(
    entries.map(([k, gs]) => [
      k,
      fightCols(
        gs.flatMap((g) => g.fights),
        gs[0]?.size ?? 1,
      ),
    ]),
  ),
);

// Per fight only for the target profile
console.log('Per fight (mixed)');
const rows: Record<string, ReturnType<typeof fightCols>> = {};
const rooms = [...new Set(ROUTE.map((l) => l.room)), 'throne'];
for (const room of rooms) {
  for (const [k, gs] of entries.filter(([k]) => k.endsWith('mixed'))) {
    const fs = gs.flatMap((g) => g.fights).filter((f) => f.room === room);
    if (fs.length)
      rows[`${room} ${k.split(' ')[0]}`] = fightCols(fs, gs[0]?.size ?? 1);
  }
}
console.table(rows);
