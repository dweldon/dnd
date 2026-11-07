import type { Dice } from './types';

const die = (sides: number) => Math.floor(Math.random() * sides) + 1;

export const d20 = () => die(20);

export function roll(dice: Dice): number {
  const [count = 0, sides = 0, bonus = 0] = dice.split(/[d+]/).map(Number);
  let total = bonus;
  for (let i = 0; i < count; i++) total += die(sides);
  return total;
}

export function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}
