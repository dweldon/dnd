// Dice notation, e.g. '2d6' or '1d8+3'
export type Dice = `${number}d${number}` | `${number}d${number}+${number}`;

export type Pos = { x: number; y: number };

// Shared by abilities and items
export type Effect =
  // Optional stun makes the target skip its next action
  | {
      kind: 'damage';
      dice: Dice;
      area: 'one' | 'all';
      autoHit?: boolean;
      stun?: boolean;
    }
  | { kind: 'heal'; dice: Dice; area: 'self' | 'one' | 'party' }
  // Lowers one monster's AC for the rest of the fight
  | { kind: 'weaken'; ac: number }
  // Permanent bonus for whoever uses the item
  | { kind: 'equip'; ac?: number; attack?: number; damage?: number };
