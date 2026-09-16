import type { Encounter } from './combat';

// Cumulative XP to reach Level 2, 3, ... Content: retune here, nowhere else.
export const LEVEL_XP = [20, 50, 100, 180, 300, 480, 750, 1150, 1750];
const BASE_HP = 5;
const HP_CAP = 10;

export type Title = 'Apprentice' | 'Adept' | 'Wizard';

export const levelForXp = (xp: number): number => 1 + LEVEL_XP.filter((threshold) => xp >= threshold).length;

export const maxHpForLevel = (level: number): number => Math.min(HP_CAP, BASE_HP + level - 1);

export const titleForLevel = (level: number): Title => (level >= 7 ? 'Wizard' : level >= 4 ? 'Adept' : 'Apprentice');

// Damage dealt is measured on the monster, so overkill never pays.
export const encounterXp = (e: Encounter): number =>
  e.spec.monsterMaxHp - e.monsterHp + (e.status === 'won' ? e.spec.monsterMaxHp : 0);
