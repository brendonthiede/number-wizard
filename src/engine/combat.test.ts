import { describe, expect, it } from 'vitest';
import { damageOf, resolveSpell, type SpellInput } from './combat';

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
