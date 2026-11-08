import type { Dice } from './types';

// Attack lines fill in {monster}, {target} and {damage}
export type Monster = {
  name: string;
  description: string;
  maxHp: number;
  ac: number;
  attack: { bonus: number; damage: Dice };
  // Attacks per monster phase (default 1)
  attacks?: number;
  boss?: boolean;
  hitLines: string[];
  missLines: string[];
  art: string;
};

export const MONSTERS = {
  goblin: {
    name: 'Goblin',
    description: 'A scrappy green goblin with a rusty spoon and big opinions.',
    maxHp: 34,
    ac: 13,
    attack: { bonus: 6, damage: '2d6+5' },
    hitLines: [
      '{monster} bonks {target} with a rusty spoon for {damage} damage.',
      '{monster} kicks {target} in the shin for {damage} damage, then cackles.',
      '{monster} jabs {target} with a pointy stick for {damage} damage.',
    ],
    missLines: [
      '{monster} lunges at {target} and trips over its own feet.',
      '{monster} swings at {target} but gets distracted by a shiny pebble.',
    ],
    art: 'monsters/goblin.svg',
  },
  'goblin-archer': {
    name: 'Goblin Archer',
    description:
      'A squinty goblin with a bent bow and a quiver of mismatched arrows.',
    maxHp: 16,
    ac: 12,
    attack: { bonus: 5, damage: '1d8+3' },
    hitLines: [
      '{monster} plinks an arrow into {target} for {damage} damage.',
      '{monster} fires a suction-cup arrow that somehow still hurts {target} for {damage} damage.',
      "{monster}'s arrow finds a gap in {target}'s guard for {damage} damage.",
    ],
    missLines: [
      "{monster}'s arrow sails past {target} and pins a goblin's hat to the wall.",
      '{monster} aims at {target}, sneezes, and shoots the ceiling.',
    ],
    art: 'monsters/goblin-archer.svg',
  },
  slime: {
    name: 'Green Slime',
    description:
      'A wobbly blob of green goo. Squishy, sticky and surprisingly tough.',
    maxHp: 60,
    ac: 8,
    attack: { bonus: 4, damage: '2d8+4' },
    hitLines: [
      '{monster} splats onto {target} for {damage} damage. Ew.',
      '{monster} slurps at {target} with sticky goo for {damage} damage.',
      '{monster} bounces into {target} like an angry jelly for {damage} damage.',
    ],
    missLines: [
      '{monster} wobbles toward {target} and slides right past.',
      '{monster} tries to engulf {target} but only gets a boot. It seems pleased anyway.',
    ],
    art: 'monsters/slime.svg',
  },
  skeleton: {
    name: 'Skeleton',
    description: 'A rattly skeleton who is a sore loser at cards.',
    maxHp: 36,
    ac: 13,
    attack: { bonus: 6, damage: '2d6+4' },
    hitLines: [
      '{monster} whacks {target} with its own femur for {damage} damage.',
      '{monster} rattles menacingly and slashes {target} for {damage} damage.',
      '{monster} throws a playing card that cuts {target} for {damage} damage.',
    ],
    missLines: [
      '{monster} swings at {target} and its arm falls off. It puts it back on.',
      '{monster} lunges at {target} but its jaw clatters to the floor.',
    ],
    art: 'monsters/skeleton.svg',
  },
  'giant-rat': {
    name: 'Giant Rat',
    description: 'A goblin pet rat the size of a corgi. Very hungry.',
    maxHp: 14,
    ac: 12,
    attack: { bonus: 5, damage: '1d6+3' },
    hitLines: [
      '{monster} nibbles {target} for {damage} damage.',
      "{monster} scurries up {target}'s leg and bites for {damage} damage.",
    ],
    missLines: [
      '{monster} snaps at {target} but gets distracted by a crumb.',
      '{monster} squeaks at {target} angrily but does no harm.',
    ],
    art: 'monsters/giant-rat.svg',
  },
  'goblin-guard': {
    name: 'Goblin Honor Guard',
    description:
      'A big goblin in polished pot-lid armor who takes their job very seriously.',
    maxHp: 40,
    ac: 15,
    attack: { bonus: 6, damage: '2d6+5' },
    hitLines: [
      '{monster} thwacks {target} with a ceremonial halberd for {damage} damage.',
      '{monster} shield-shoves {target} for {damage} damage and shouts "For the King!"',
      '{monster} pokes {target} with great professionalism for {damage} damage.',
    ],
    missLines: [
      '{monster} swings at {target} but stops to straighten its helmet.',
      "{monster}'s halberd gets stuck in a banner as it swings at {target}.",
    ],
    art: 'monsters/goblin-guard.svg',
  },
  'goblin-king': {
    name: 'Grizzlebeans, the Goblin King',
    description:
      "A wide-eyed, twitching goblin king, supercharged by endless cups from the village's enchanted coffee pot.",
    maxHp: 140,
    ac: 15,
    attack: { bonus: 7, damage: '2d6+4' },
    attacks: 2,
    boss: true,
    hitLines: [
      '{monster} smashes {target} with his royal scepter for {damage} damage.',
      '{monster} hurls a scalding mug at {target} for {damage} damage.',
      '{monster} zips across the room at caffeinated speed and punches {target} for {damage} damage.',
      '{monster} yells "MINE!" and bonks {target} with the coffee pot for {damage} damage.',
    ],
    missLines: [
      '{monster} swings at {target} but is vibrating too much to aim.',
      '{monster} lunges at {target}, then stops to take a long, loud sip.',
      '{monster} throws a mug at {target}, misses, and demands another mug.',
    ],
    art: 'monsters/goblin-king.svg',
  },
} satisfies Record<string, Monster>;

export type MonsterId = keyof typeof MONSTERS;
