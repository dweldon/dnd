import type { Effect } from './types';

export type Item = {
  name: string;
  description: string;
  effect: Effect;
  icon: string;
};

export const ITEMS = {
  'healing-potion': {
    name: 'Potion of Healing',
    description: 'A fizzy red potion that tastes like cherry cough syrup.',
    effect: { kind: 'heal', dice: '2d4+2', area: 'one' },
    icon: 'items/healing-potion.svg',
  },
  'greater-healing-potion': {
    name: 'Greater Potion of Healing',
    description: 'A glowing ruby potion. Smells faintly of cinnamon rolls.',
    effect: { kind: 'heal', dice: '4d4+4', area: 'one' },
    icon: 'items/greater-healing-potion.svg',
  },
  'fizzbang-bomb': {
    name: 'Fizzbang Bomb',
    description: 'A goblin party popper that is far too enthusiastic.',
    effect: { kind: 'damage', dice: '2d6', area: 'all', autoHit: true },
    icon: 'items/fizzbang-bomb.svg',
  },
  'decaf-dust': {
    name: 'Emergency Decaf',
    description:
      "A jar of decaf powder. Slip it into the Goblin King's coffee and his jittery reflexes fade.",
    effect: { kind: 'weaken', ac: 4 },
    icon: 'items/decaf-dust.svg',
  },
  'ring-of-protection': {
    name: 'Ring of Protection',
    description: 'A silver ring that makes blows glance away. +2 AC.',
    effect: { kind: 'equip', ac: 2 },
    icon: 'items/ring-of-protection.svg',
  },
  'early-riser-gauntlets': {
    name: 'Gauntlets of the Early Riser',
    description:
      'Sunrise-orange gauntlets that hum with morning energy. +1 to hit, +2 damage.',
    effect: { kind: 'equip', attack: 1, damage: 2 },
    icon: 'items/early-riser-gauntlets.svg',
  },
} satisfies Record<string, Item>;

export type ItemId = keyof typeof ITEMS;
