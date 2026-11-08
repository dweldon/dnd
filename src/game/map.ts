import type { ItemId } from './items';
import type { MonsterId } from './monsters';
import type { Effect, Pos } from './types';

// '#' wall, '.' floor, '+' door, 'S' secret door (looks like wall until found)
export type Tile = '#' | '.' | '+' | 'S';

// Room floor corners, clear of monsters (top row middle) and the party (center)
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export type Room = {
  id: string;
  name: string;
  // Floor area, excluding the surrounding walls
  rect: { x: number; y: number; w: number; h: number };
  description: string;
  // CSS color for a soft light overlay on the floor
  tint?: string;
  // Clue pointing at this room's secret door
  hint?: string;
  secret?: { door: Pos; dc: number };
  // One-off interaction, e.g. eating cookies
  feature?: { name: string; effect: Effect };
  // Solved once; answers are lowercase single words
  riddle?: { question: string; answers: string[]; reward: ItemId[] };
  // Decorative corner art; 'until' hides it once the feature is used or riddle solved
  props?: { art: string; at: Corner; until?: 'used' | 'solved' }[];
  monsters: MonsterId[];
  loot: ItemId[];
  safe?: boolean;
  hidden?: boolean;
  boss?: boolean;
};

const GRID = [
  '################################################',
  '################################################',
  '###.........####.......####........####.......##',
  '###.........####.......####........####.......##',
  '###.........+..+.......####........+..+.......##',
  '###.........####.......+..+........####.......##',
  '###.........####.......####........####.......##',
  '###.........####.......####........#######+#####',
  '###.........#######S######################.#####',
  '######+##########.....####################.#####',
  '######.##########.....####################+#####',
  '######+################################........#',
  '###.......######........####.........##........#',
  '###.......######........####.........##........#',
  '###.......+....+........####.........##........#',
  '###.......######........+..+.........##........#',
  '###.......######........####.........##........#',
  '###.......######........####.........##........#',
  '#####S##########........####.........##........#',
  '###.....##########+############+#######........#',
  '###.....##########.############.################',
  '###.....##########.############.################',
  '##################+############+################',
  '##############........#####.........############',
  '##.......#####........#####.........#......#####',
  '##.......#####........+...+.........#......#####',
  '##.......+...+........#####.........S......#####',
  '##.......#####........#####.........#......#####',
  '##.......#####........#####.........#......#####',
  '##.......##################.........############',
  '################################################',
];

// Indexed as TILES[y][x]
export const TILES = GRID.map((row) => [...row] as Tile[]);
export const WIDTH = GRID[0]?.length ?? 0;
export const HEIGHT = GRID.length;
export const START: Pos = { x: 5, y: 27 };

export const ROOMS: Room[] = [
  {
    id: 'entrance',
    name: 'Mossy Entrance',
    rect: { x: 2, y: 24, w: 7, h: 6 },
    tint: '#4ade80',
    description:
      "A damp cave mouth beneath Mount Mugg. A hand-painted sign reads 'GOBLINS ONLY. NO KNIGHTS. NO ELVES. ESPECIALLY NO BARDS.' Muddy footprints and a faint smell of fresh coffee lead east.",
    props: [{ art: 'goblin-sign', at: 'se' }],
    monsters: [],
    loot: [],
    safe: true,
  },
  {
    id: 'guard-post',
    name: 'Goblin Guard Post',
    rect: { x: 14, y: 23, w: 8, h: 6 },
    tint: '#f59e0b',
    description:
      "A cramped guard post with a table covered in half-finished crossword puzzles. Two goblin guards are arguing over a seven-letter word for 'sneaky'. Passages lead east and north.",
    props: [{ art: 'crossword', at: 'sw' }],
    monsters: ['goblin', 'goblin'],
    loot: [],
  },
  {
    id: 'grotto',
    name: 'Glowing Fungus Grotto',
    rect: { x: 27, y: 23, w: 9, h: 7 },
    tint: '#a855f7',
    description:
      'A wide cavern full of mushrooms glowing soft blue and purple. Some of them hum quietly to themselves. One looks suspiciously like a tiny armchair. A passage leads north.',
    hint: 'The mushrooms by the east wall all lean the same way, as if a steady draft were pushing them.',
    secret: { door: { x: 36, y: 26 }, dc: 13 },
    feature: {
      name: 'Mushroom Armchair',
      effect: { kind: 'heal', dice: '2d6', area: 'self' },
    },
    props: [{ art: 'mushroom-armchair', at: 'sw', until: 'used' }],
    monsters: [],
    loot: [],
  },
  {
    id: 'pantry',
    name: 'Forgotten Pantry',
    rect: { x: 37, y: 24, w: 6, h: 5 },
    tint: '#a8825a',
    description:
      'A dusty, long-forgotten goblin snack pantry. Shelves of pickled beetles and a wheel of truly ancient cheese, plus a few things actually worth taking.',
    props: [{ art: 'cheese', at: 'se' }],
    monsters: [],
    loot: ['healing-potion', 'healing-potion', 'fizzbang-bomb'],
    hidden: true,
  },
  {
    id: 'slime-pools',
    name: 'Bubbling Slime Pools',
    rect: { x: 28, y: 12, w: 9, h: 7 },
    tint: '#84cc16',
    description:
      'Shallow pools of bubbling green goo. Two slimes wobble contentedly, slowly absorbing a lost boot. They notice you and wobble less contentedly. A potion bobs in the goo. Passages lead west and south.',
    props: [{ art: 'lost-boot', at: 'se' }],
    monsters: ['slime', 'slime'],
    loot: ['healing-potion'],
  },
  {
    id: 'crypt',
    name: 'Card-Playing Crypt',
    rect: { x: 16, y: 12, w: 8, h: 7 },
    tint: '#94a3b8',
    description:
      'An old crypt where three skeletons sit around a coffin lid playing cards. One has clearly been cheating for about four hundred years. They rise, rattling, annoyed at the interruption. Passages lead west, east and south.',
    props: [{ art: 'card-coffin', at: 'sw' }],
    monsters: ['skeleton', 'skeleton', 'skeleton'],
    loot: [],
  },
  {
    id: 'shrine',
    name: 'Shrine of the Sleepy Saint',
    rect: { x: 3, y: 12, w: 7, h: 6 },
    tint: '#fde68a',
    description:
      'A peaceful chapel to Saint Snoozewell, patron of naps. A soft golden glow fills the room and the air smells of lavender. Nothing hostile would dare make noise here. Passages lead north and east.',
    hint: 'One floor stone by the south wall is worn smooth, as if pilgrims kept kneeling there, and it sounds hollow underfoot.',
    secret: { door: { x: 5, y: 18 }, dc: 12 },
    props: [{ art: 'candles', at: 'se' }],
    monsters: [],
    loot: [],
    safe: true,
  },
  {
    id: 'reliquary',
    name: "Saint's Reliquary",
    rect: { x: 3, y: 19, w: 5, h: 3 },
    tint: '#e11d48',
    description:
      "A tiny hidden vault with a velvet pillow, a very old nightcap, and the saint's treasured belongings.",
    props: [{ art: 'velvet-pillow', at: 'sw' }],
    monsters: [],
    loot: ['ring-of-protection', 'greater-healing-potion'],
    hidden: true,
  },
  {
    id: 'mess-hall',
    name: 'Goblin Mess Hall',
    rect: { x: 3, y: 2, w: 9, h: 7 },
    tint: '#ea580c',
    description:
      "Long tables, a cauldron of mystery stew, and a chore wheel nobody follows. Two goblins are eating lunch while their pet rats beg for scraps. A sign reads 'THE KING'S COFFEE IS FOR THE KING ONLY.' Passages lead east and south.",
    props: [{ art: 'cauldron', at: 'sw' }],
    monsters: ['goblin', 'goblin', 'giant-rat', 'giant-rat'],
    loot: [],
  },
  {
    id: 'library',
    name: 'Library of Overdue Books',
    rect: { x: 16, y: 2, w: 7, h: 6 },
    tint: '#d6a35c',
    description:
      "Towering shelves of books, all overdue by centuries. The goblin librarian's desk holds a single rubber stamp that only says 'NO.' A talking book on the desk clears its spine and offers a prize for answering its riddle. Passages lead west and east.",
    hint: "A cold draft blows from under the bookshelf on the south wall, where one book titled 'Definitely Not a Lever' sticks out.",
    secret: { door: { x: 19, y: 8 }, dc: 14 },
    riddle: {
      question: 'What has many keys but cannot open a single lock?',
      answers: ['piano', 'keyboard', 'keyboards', 'pianos'],
      reward: ['fizzbang-bomb', 'healing-potion'],
    },
    props: [{ art: 'talking-book', at: 'se', until: 'solved' }],
    monsters: [],
    loot: [],
  },
  {
    id: 'supply-closet',
    name: 'Royal Supply Closet',
    rect: { x: 17, y: 9, w: 5, h: 2 },
    tint: '#fb923c',
    description:
      "The Goblin King's private supply closet: spare crowns, a dented trumpet, a pair of glowing orange gauntlets and a jar labeled 'EMERGENCY DECAF. DO NOT USE.'",
    props: [{ art: 'crown', at: 'se' }],
    monsters: [],
    loot: ['decaf-dust', 'early-riser-gauntlets'],
    hidden: true,
  },
  {
    id: 'antechamber',
    name: 'Royal Antechamber',
    rect: { x: 27, y: 2, w: 8, h: 6 },
    tint: '#dc2626',
    description:
      "A grand hall hung with goblin banners and a red carpet that is mostly rug burns. Two of the King's honor guard stand at attention while a goblin archer practices on a target painted like the village baker. Passages lead west and east.",
    props: [{ art: 'target', at: 'se' }],
    monsters: ['goblin-guard', 'goblin-guard', 'goblin-archer'],
    loot: [],
  },
  {
    id: 'waiting-room',
    name: 'Royal Waiting Room',
    rect: { x: 39, y: 2, w: 7, h: 5 },
    description:
      "Uncomfortable chairs, a ticket machine and a sign reading 'NOW SERVING: 3.' Someone left out a plate of cookies. Loud slurping echoes from a door to the south. It feels oddly safe here. Passages lead west and south.",
    feature: {
      name: 'Plate of Cookies',
      effect: { kind: 'heal', dice: '1d6', area: 'party' },
    },
    props: [{ art: 'cookies', at: 'sw', until: 'used' }],
    monsters: [],
    loot: [],
    safe: true,
  },
  {
    id: 'throne',
    name: 'Throne Room',
    rect: { x: 39, y: 11, w: 8, h: 9 },
    tint: '#facc15',
    description:
      "A cavernous throne room. On a throne built from stolen mugs sits Grizzlebeans the Goblin King, wide-eyed and twitching, sipping straight from the village's enchanted coffee pot. Two goblin attendants flank him.",
    props: [
      { art: 'coffee-pot', at: 'sw' },
      { art: 'torch', at: 'nw' },
      { art: 'torch', at: 'ne' },
      { art: 'torch', at: 'se' },
    ],
    monsters: ['goblin-king', 'goblin', 'goblin'],
    loot: [],
    boss: true,
  },
];
