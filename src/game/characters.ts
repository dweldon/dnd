import type { ItemId } from './items';
import type { Dice, Effect } from './types';

// Cooldown N: after use, the ability is unavailable for the owner's next N turns
export type Ability = {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  effect: Effect;
};

export type Character = {
  name: string;
  className: string;
  race: string;
  pronouns: string;
  blurb: string;
  maxHp: number;
  ac: number;
  attack: { name: string; bonus: number; damage: Dice };
  abilities: Ability[];
  gear: string[];
  items: ItemId[];
  searchBonus: number;
  // HP restored when this hero revives a downed ally
  reviveHeal: Dice;
  portrait: string;
};

export const CHARACTERS = {
  wizard: {
    name: 'Mirabel Quickwick',
    className: 'Wizard',
    race: 'Gnome',
    pronouns: 'she/her',
    blurb:
      'A brilliant, easily distracted gnome who labels everything, including her own eyebrows.',
    maxHp: 18,
    ac: 12,
    attack: { name: 'Fire Bolt', bonus: 5, damage: '1d10' },
    abilities: [
      {
        id: 'magic-missile',
        name: 'Magic Missile',
        description: 'Three glowing darts that never miss.',
        cooldown: 2,
        effect: { kind: 'damage', dice: '3d4+3', area: 'one', autoHit: true },
      },
      {
        id: 'fireball',
        name: 'Fireball',
        description: 'A roaring burst of flame that hits every enemy.',
        cooldown: 4,
        effect: { kind: 'damage', dice: '3d6', area: 'all' },
      },
      {
        id: 'frost-ray',
        name: 'Frost Ray',
        description: 'An icy beam that freezes the target in place.',
        cooldown: 3,
        effect: { kind: 'damage', dice: '2d8', area: 'one', stun: true },
      },
    ],
    gear: ['Quarterstaff', 'Spellbook with sticky notes', 'Pointy hat'],
    items: ['healing-potion'],
    searchBonus: 2,
    reviveHeal: '1d4+2',
    portrait: 'portraits/wizard.svg',
  },
  fighter: {
    name: 'Sir Brannoc Steelbottom',
    className: 'Fighter',
    race: 'Human',
    pronouns: 'he/him',
    blurb:
      'A cheerful knight who polishes his armor twice a day and salutes doors before opening them.',
    maxHp: 34,
    ac: 17,
    attack: { name: 'Longsword', bonus: 6, damage: '1d10+4' },
    abilities: [
      {
        id: 'power-strike',
        name: 'Power Strike',
        description: 'A mighty two-handed swing.',
        cooldown: 2,
        effect: { kind: 'damage', dice: '2d10+4', area: 'one' },
      },
      {
        id: 'shield-bash',
        name: 'Shield Bash',
        description: 'A clang to the head that leaves the target dazed.',
        cooldown: 3,
        effect: { kind: 'damage', dice: '1d6+4', area: 'one', stun: true },
      },
      {
        id: 'second-wind',
        name: 'Second Wind',
        description: 'A deep breath and a stretch to recover some HP.',
        cooldown: 4,
        effect: { kind: 'heal', dice: '1d10+4', area: 'self' },
      },
    ],
    gear: ['Longsword', 'Shield', 'Very shiny plate armor'],
    items: ['healing-potion'],
    searchBonus: 0,
    reviveHeal: '1d4+2',
    portrait: 'portraits/fighter.svg',
  },
  cleric: {
    name: 'Sister Tansy Brightkettle',
    className: 'Cleric',
    race: 'Halfling',
    pronouns: 'she/her',
    blurb:
      'A warm-hearted halfling priestess who believes every problem can be solved with tea and a hug.',
    maxHp: 26,
    ac: 16,
    attack: { name: 'Mace', bonus: 5, damage: '1d6+3' },
    abilities: [
      {
        id: 'healing-word',
        name: 'Healing Word',
        description: 'A kind word that mends one ally.',
        cooldown: 2,
        effect: { kind: 'heal', dice: '2d4+3', area: 'one' },
      },
      {
        id: 'prayer-of-healing',
        name: 'Prayer of Healing',
        description: 'A gentle prayer that heals the whole party.',
        cooldown: 4,
        effect: { kind: 'heal', dice: '1d8+2', area: 'party' },
      },
      {
        id: 'sacred-flame',
        name: 'Sacred Flame',
        description: 'Radiant light that always finds its mark.',
        cooldown: 2,
        effect: { kind: 'damage', dice: '2d8', area: 'one', autoHit: true },
      },
    ],
    gear: ['Mace', 'Holy symbol shaped like a teapot', 'Chain mail'],
    items: ['healing-potion', 'healing-potion'],
    searchBonus: 1,
    reviveHeal: '2d8+4',
    portrait: 'portraits/cleric.svg',
  },
  thief: {
    name: 'Pip Lightfingers',
    className: 'Thief',
    race: 'Elf',
    pronouns: 'they/them',
    blurb:
      'A nimble elf who "borrows" things and always returns them, eventually, usually.',
    maxHp: 22,
    ac: 15,
    attack: { name: 'Daggers', bonus: 7, damage: '1d6+4' },
    abilities: [
      {
        id: 'sneak-attack',
        name: 'Sneak Attack',
        description: 'A precise strike to a weak spot.',
        cooldown: 2,
        effect: { kind: 'damage', dice: '3d6+4', area: 'one' },
      },
      {
        id: 'pocket-sand',
        name: 'Pocket Sand',
        description: 'A handful of sand to the eyes. Classic.',
        cooldown: 3,
        effect: { kind: 'damage', dice: '1d4', area: 'one', stun: true },
      },
      {
        id: 'expose-weakness',
        name: 'Expose Weakness',
        description:
          "Points out a gap in the target's armor. It's easier to hit for the rest of the fight.",
        cooldown: 3,
        effect: { kind: 'weaken', ac: 2 },
      },
    ],
    gear: ['Twin daggers', "Thieves' tools", 'Hooded cloak'],
    items: ['healing-potion'],
    searchBonus: 8,
    reviveHeal: '1d4+2',
    portrait: 'portraits/thief.svg',
  },
  barbarian: {
    name: 'Grunda Ironbelly',
    className: 'Barbarian',
    race: 'Dwarf',
    pronouns: 'she/her',
    blurb:
      'A booming dwarf with a huge axe, a bigger laugh and a snack in every pocket.',
    maxHp: 38,
    ac: 14,
    attack: { name: 'Greataxe', bonus: 6, damage: '1d12+4' },
    abilities: [
      {
        id: 'reckless-swing',
        name: 'Reckless Swing',
        description: 'All-in swing with no regard for personal safety.',
        cooldown: 2,
        effect: { kind: 'damage', dice: '2d12+4', area: 'one' },
      },
      {
        id: 'whirlwind',
        name: 'Whirlwind',
        description: 'A spinning axe attack that hits every enemy.',
        cooldown: 3,
        effect: { kind: 'damage', dice: '1d12+2', area: 'all' },
      },
      {
        id: 'snack-break',
        name: 'Snack Break',
        description: 'Eats a pocket sandwich mid-fight to restore HP.',
        cooldown: 4,
        effect: { kind: 'heal', dice: '2d6+4', area: 'self' },
      },
    ],
    gear: ['Greataxe', 'Fur cloak', 'Many sandwiches'],
    items: ['healing-potion'],
    searchBonus: 0,
    reviveHeal: '1d4+2',
    portrait: 'portraits/barbarian.svg',
  },
  ranger: {
    name: 'Fennick Ashgrove',
    className: 'Ranger',
    race: 'Half-elf',
    pronouns: 'he/him',
    blurb:
      'A calm half-elf tracker who talks to birds and is slightly disappointed when they never answer.',
    maxHp: 28,
    ac: 15,
    attack: { name: 'Longbow', bonus: 7, damage: '1d8+4' },
    abilities: [
      {
        id: 'hunters-mark',
        name: "Hunter's Mark",
        description: 'A carefully aimed arrow at a marked foe.',
        cooldown: 2,
        effect: { kind: 'damage', dice: '2d8+4', area: 'one' },
      },
      {
        id: 'volley',
        name: 'Volley',
        description: 'A rain of arrows on every enemy.',
        cooldown: 3,
        effect: { kind: 'damage', dice: '1d8+2', area: 'all' },
      },
      {
        id: 'healing-herbs',
        name: 'Healing Herbs',
        description: 'A poultice of forest herbs for one ally.',
        cooldown: 3,
        effect: { kind: 'heal', dice: '1d8+3', area: 'one' },
      },
    ],
    gear: ['Longbow', 'Quiver of arrows', 'Pouch of herbs'],
    items: ['healing-potion'],
    searchBonus: 3,
    reviveHeal: '1d4+2',
    portrait: 'portraits/ranger.svg',
  },
} satisfies Record<string, Character>;

export type CharacterId = keyof typeof CHARACTERS;
