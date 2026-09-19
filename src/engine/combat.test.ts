import { describe, expect, it } from 'vitest';
import { castSpell, damageOf, resolveSpell, rollLoot, servedFacts, startEncounter, type EncounterSpec, type SpellInput } from './combat';

const T = 4000;
const spell = (over: Partial<SpellInput> = {}): SpellInput => ({
  factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 2000, ...over,
});

describe('resolveSpell', () => {
  it('is a Critical Hit when correct, Work correct, and under the threshold', () => {
    expect(resolveSpell(spell({ durationMs: 3999 }), T)).toBe('critical');
  });

  it('is a Hit at or over the threshold', () => {
    expect(resolveSpell(spell({ durationMs: 4000 }), T)).toBe('hit');
    expect(resolveSpell(spell({ durationMs: 60000 }), T)).toBe('hit');
  });

  it('is a Glancing Blow when some Work is wrong, at any speed (invariant 5)', () => {
    for (const durationMs of [0, 1, 3999, 4000, 60000]) {
      expect(resolveSpell(spell({ workCorrect: false, durationMs }), T)).toBe('glancing');
    }
  });

  it('is a Miss when the final answer is wrong, however fast and whatever the Work', () => {
    expect(resolveSpell(spell({ correct: false, answer: 13, durationMs: 1 }), T)).toBe('miss');
    expect(resolveSpell(spell({ correct: false, workCorrect: false }), T)).toBe('miss');
  });
});

describe('damageOf', () => {
  it('deals 2 for a Critical Hit, 1 for a Hit or Glancing Blow, 0 for a Miss', () => {
    expect(damageOf('critical')).toBe(2);
    expect(damageOf('hit')).toBe(1);
    expect(damageOf('glancing')).toBe(1);
    expect(damageOf('miss')).toBe(0);
  });
});

const NOW = new Date('2026-09-16T12:00:00.000Z');
const spec: EncounterSpec = { id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 3 };

describe('startEncounter', () => {
  it('starts with the monster at max HP and the Character at full HP', () => {
    expect(startEncounter(spec, 5, NOW)).toEqual({
      spec, monsterHp: 3, characterHp: 5, characterMaxHp: 5, spells: [], startedAt: NOW.toISOString(), status: 'active',
    });
  });

  it('throws on non-positive monster max HP (F9)', () => {
    expect(() => startEncounter({ ...spec, monsterMaxHp: 0 }, 5, NOW)).toThrow('Encounter e1 cannot start: monster HP 0');
  });

  it('throws on non-positive Character max HP (F9)', () => {
    expect(() => startEncounter(spec, 0, NOW)).toThrow('Encounter e1 cannot start: Character HP 0');
  });
});

describe('castSpell', () => {
  it('records the Attempt with its outcome and damages the monster on a Hit', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), spell({ durationMs: 5000 }), T, NOW);
    expect(e.monsterHp).toBe(2);
    expect(e.characterHp).toBe(5);
    expect(e.spells).toEqual([{
      factId: 'tt:3x4', answer: 12, correct: true, durationMs: 5000,
      at: NOW.toISOString(), encounterId: 'e1', outcome: 'hit',
    }]);
    expect(e.status).toBe('active');
  });

  it('costs the Character 1 HP on a Miss and leaves the monster alone', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), spell({ correct: false }), T, NOW);
    expect(e.monsterHp).toBe(3);
    expect(e.characterHp).toBe(4);
  });

  it('is won when monster HP reaches 0, never below', () => {
    let e = castSpell(startEncounter(spec, 5, NOW), spell(), T, NOW); // critical, 2
    e = castSpell(e, spell(), T, NOW); // critical, 2 more; overkill
    expect(e.monsterHp).toBe(0);
    expect(e.status).toBe('won');
  });

  it('is retreated when Character HP reaches 0', () => {
    let e = startEncounter(spec, 2, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    expect(e.characterHp).toBe(0);
    expect(e.status).toBe('retreated');
  });

  it('throws once the Encounter has ended', () => {
    let e = startEncounter(spec, 1, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    expect(() => castSpell(e, spell(), T, NOW)).toThrow('Encounter e1 is retreated');
  });

  it('does not mutate the previous Encounter', () => {
    const before = startEncounter(spec, 5, NOW);
    castSpell(before, spell(), T, NOW);
    expect(before.spells).toEqual([]);
    expect(before.monsterHp).toBe(3);
  });

  it('always ends within monster max HP plus Character max HP Spells (invariant 1)', () => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let run = 0; run < 200; run++) {
      const big = { ...spec, monsterMaxHp: 1 + Math.floor(rng() * 15) };
      const maxHp = 5 + Math.floor(rng() * 6);
      let e = startEncounter(big, maxHp, NOW);
      let casts = 0;
      while (e.status === 'active') {
        e = castSpell(e, spell({ correct: rng() < 0.6, workCorrect: rng() < 0.8, durationMs: rng() * 8000 }), T, NOW);
        casts++;
        expect(casts).toBeLessThanOrEqual(big.monsterMaxHp + maxHp);
      }
    }
  });
});

describe('servedFacts', () => {
  it('is the set of Facts cast so far', () => {
    let e = startEncounter(spec, 5, NOW);
    e = castSpell(e, spell({ factId: 'tt:2x2', correct: false }), T, NOW);
    e = castSpell(e, spell({ factId: 'tt:2x3', correct: false }), T, NOW);
    e = castSpell(e, spell({ factId: 'tt:2x2', correct: false }), T, NOW);
    expect([...servedFacts(e)].sort()).toEqual(['tt:2x2', 'tt:2x3']);
  });
});

describe('rollLoot', () => {
  it('picks one id from the pool by the RNG, or null from an empty pool', () => {
    expect(rollLoot(['hat', 'staff', 'cloak'], () => 0.5)).toBe('staff');
    expect(rollLoot(['hat', 'staff', 'cloak'], () => 0.999)).toBe('cloak');
    expect(rollLoot([], () => 0)).toBeNull();
  });

  it('clamps an RNG of exactly 1 to the last item (F6)', () => {
    expect(rollLoot(['a', 'b'], () => 1)).toBe('b');
  });

  it('clamps a negative RNG to the first item', () => {
    expect(rollLoot(['a', 'b'], () => -0.5)).toBe('a');
  });
});

describe('castSpell records the Work', () => {
  it('copies operands, Work and labelsShown onto a grid Attempt', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), {
      factId: 'md:2x1', answer: 282, correct: true, workCorrect: false, durationMs: 9000,
      operands: [47, 6], work: [42, null], labelsShown: true,
    }, 20000, NOW);
    expect(e.spells[0]).toMatchObject({ outcome: 'glancing', operands: [47, 6], work: [42, null], labelsShown: true });
  });

  it('adds no new key to a table Attempt', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), { factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 900 }, 4000, NOW);
    expect(Object.keys(e.spells[0]!).sort()).toEqual(['answer', 'at', 'correct', 'durationMs', 'encounterId', 'factId', 'outcome']);
  });
});
