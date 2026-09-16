import { describe, expect, it } from 'vitest';
import { encounterXp, LEVEL_XP, levelForXp, maxHpForLevel, titleForLevel } from './character';
import { castSpell, startEncounter, type EncounterSpec, type SpellInput } from './combat';

const T = 4000;
const NOW = new Date('2026-09-16T12:00:00.000Z');
const spec: EncounterSpec = { id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 6 };
const spell = (over: Partial<SpellInput> = {}): SpellInput => ({
  factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 2000, ...over,
});

describe('levelForXp', () => {
  it('is Level 1 below the first threshold and climbs one Level per threshold', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(19)).toBe(1);
    expect(levelForXp(20)).toBe(2);
    expect(levelForXp(49)).toBe(2);
    expect(levelForXp(50)).toBe(3);
    expect(levelForXp(1750)).toBe(LEVEL_XP.length + 1);
    expect(levelForXp(999999)).toBe(LEVEL_XP.length + 1);
  });

  it('never decreases as XP grows (invariant 4)', () => {
    let last = 0;
    for (let xp = 0; xp <= 2000; xp++) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });
});

describe('maxHpForLevel', () => {
  it('starts at 5, gains 1 per Level, and caps at 10', () => {
    expect(maxHpForLevel(1)).toBe(5);
    expect(maxHpForLevel(2)).toBe(6);
    expect(maxHpForLevel(6)).toBe(10);
    expect(maxHpForLevel(7)).toBe(10);
  });

  it('stays within 5 to 10 for Levels 1 through 20 (invariant 3)', () => {
    for (let level = 1; level <= 20; level++) {
      expect(maxHpForLevel(level)).toBeGreaterThanOrEqual(5);
      expect(maxHpForLevel(level)).toBeLessThanOrEqual(10);
    }
  });
});

describe('titleForLevel', () => {
  it('is Apprentice for 1 to 3, Adept for 4 to 6, Wizard from 7', () => {
    expect([1, 3, 4, 6, 7, 12].map(titleForLevel)).toEqual([
      'Apprentice', 'Apprentice', 'Adept', 'Adept', 'Wizard', 'Wizard',
    ]);
  });
});

describe('encounterXp', () => {
  it('is damage dealt plus the monster max HP on a win, without overkill', () => {
    let e = startEncounter(spec, 5, NOW);
    for (let i = 0; i < 3; i++) e = castSpell(e, spell(), T, NOW); // 3 Critical Hits, 6 damage
    expect(e.status).toBe('won');
    expect(encounterXp(e)).toBe(6 + 6);
    let over = startEncounter({ ...spec, monsterMaxHp: 3 }, 5, NOW);
    over = castSpell(over, spell(), T, NOW);
    over = castSpell(over, spell(), T, NOW); // 4 rolled, 3 dealt
    expect(encounterXp(over)).toBe(3 + 3);
  });

  it('keeps every XP point on Retreat: damage dealt, no bonus (invariant 2)', () => {
    let e = startEncounter(spec, 2, NOW);
    e = castSpell(e, spell({ durationMs: 5000 }), T, NOW); // Hit, 1
    e = castSpell(e, spell({ correct: false }), T, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    expect(e.status).toBe('retreated');
    expect(encounterXp(e)).toBe(1);
  });

  it('is 0 for an active Encounter with no damage yet', () => {
    expect(encounterXp(startEncounter(spec, 5, NOW))).toBe(0);
  });
});
