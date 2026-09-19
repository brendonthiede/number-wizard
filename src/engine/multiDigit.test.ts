import { describe, expect, it } from 'vitest';
import { factStatus } from './mastery';
import { checkWork, isTierId, isWorkCorrect, multiDigitProblem, openTiers, TIERS, TIER_MASTERY_STREAK, TierId } from './multiDigit';
import { masteryStreakFor } from './rows';
import { MasteryState, type Attempt, type FactStatus } from './types';

const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const mastered: FactStatus = { state: MasteryState.Mastered, streak: 5, dueAt: '2030-01-01T00:00:00.000Z' };
const learning: FactStatus = { state: MasteryState.Learning, streak: 0, dueAt: null };

describe('Tiers', () => {
  it('lists three Tiers in opening order with the spec thresholds', () => {
    expect(TIERS.map((t) => [t.id, t.digits, t.thresholdMs])).toEqual([
      ['md:2x1', [2, 1], 20000], ['md:3x1', [3, 1], 30000], ['md:2x2', [2, 2], 45000],
    ]);
    expect(TIERS.every((t) => t.skill === 'multi-digit-multiplication')).toBe(true);
    expect(isTierId('md:2x2')).toBe(true);
    expect(isTierId('tt:2x2')).toBe(false);
  });

  it('opens the first Tier always, the next when the one before is Mastered, and never takes a met Tier away', () => {
    expect(openTiers({}).map((t) => t.id)).toEqual(['md:2x1']);
    expect(openTiers({ 'md:2x1': learning }).map((t) => t.id)).toEqual(['md:2x1']);
    expect(openTiers({ 'md:2x1': mastered }).map((t) => t.id)).toEqual(['md:2x1', 'md:3x1']);
    expect(openTiers({ 'md:2x1': learning, 'md:3x1': learning }).map((t) => t.id)).toEqual(['md:2x1', 'md:3x1']);
    expect(openTiers({ 'md:2x1': mastered, 'md:3x1': mastered }).map((t) => t.id)).toEqual(['md:2x1', 'md:3x1', 'md:2x2']);
  });
});

describe('multiDigitProblem', () => {
  it('builds operands with no zero digit, the second from 2 to 9, and Work that sums to the answer', () => {
    const rng = seeded(7);
    for (const tier of TIERS) {
      for (let i = 0; i < 300; i++) {
        const p = multiDigitProblem(tier, rng);
        const [a, b] = p.operands!;
        expect(String(a)).toHaveLength(tier.digits[0]);
        expect(String(b)).toHaveLength(tier.digits[1]);
        expect(String(a)).not.toContain('0');
        expect(String(b)).toMatch(/^[2-9]+$/);
        expect(p.factId).toBe(tier.id);
        expect(p.skill).toBe('multi-digit-multiplication');
        expect(p.prompt).toBe(`${a} × ${b}`);
        expect(p.answer).toBe(a * b);
        expect(p.work).toHaveLength(tier.digits[0] * tier.digits[1]);
        expect(p.work!.reduce((sum, c) => sum + c.value, 0)).toBe(a * b);
      }
    }
  });

  it('never breaks when the rng returns its extremes', () => {
    for (const r of [0, 0.999999]) {
      const p = multiDigitProblem(TIERS[2]!, () => r);
      expect(p.operands![0]).toBeGreaterThanOrEqual(11);
      expect(p.operands![0]).toBeLessThanOrEqual(99);
    }
  });

  it('labels cells ones digit of the second operand first', () => {
    // 47 × 36: digits come from the rng in order 4, 7, 3, 6.
    const digits = [4, 7, 3, 6];
    let i = 0;
    const first = (d: number) => (d - 1) / 9 + 0.001; // digit 1 to 9
    const second = (d: number) => (d - 2) / 8 + 0.001; // digit 2 to 9
    const rng = () => { const d = digits[i]!; const r = i < 2 ? first(d) : second(d); i++; return r; };
    const p = multiDigitProblem(TIERS[2]!, rng);
    expect(p.operands).toEqual([47, 36]);
    expect(p.work).toEqual([
      { label: '6 × 7', value: 42 }, { label: '6 × 40', value: 240 },
      { label: '30 × 7', value: 210 }, { label: '30 × 40', value: 1200 },
    ]);
  });
});

describe('checkWork (invariant 1)', () => {
  it('accepts the right partial products in any order', () => {
    expect(checkWork([42, 240], [42, 240])).toEqual([true, true]);
    expect(checkWork([42, 240], [240, 42])).toEqual([true, true]);
    expect(checkWork([42, 240, 210, 1200], [1200, 42, 210, 240])).toEqual([true, true, true, true]);
  });

  it('marks a wrong, empty or repeated value wrong', () => {
    expect(checkWork([42, 240], [42, 241])).toEqual([true, false]);
    expect(checkWork([42, 240], [null, 240])).toEqual([false, true]);
    expect(checkWork([42, 240], [42, 42])).toEqual([true, false]);
  });

  it('needs a duplicate partial product twice (33 × 33 has 90 twice)', () => {
    expect(checkWork([9, 90, 90, 900], [90, 9, 900, 90])).toEqual([true, true, true, true]);
    expect(checkWork([9, 90, 90, 900], [90, 9, 900, null])).toEqual([true, true, true, false]);
  });

  it('isWorkCorrect is true for a Problem with no Work and false for a short entry', () => {
    const table = { factId: 'tt:3x4', skill: 'times-table' as const, prompt: '3 × 4', answer: 12 };
    expect(isWorkCorrect(table, [])).toBe(true);
    const p = multiDigitProblem(TIERS[0]!, seeded(3));
    const values = p.work!.map((c) => c.value);
    expect(isWorkCorrect(p, [...values].reverse())).toBe(true);
    expect(isWorkCorrect(p, values.slice(1))).toBe(false);
    expect(isWorkCorrect(p, [])).toBe(false);
  });
});

describe('Tier Mastery (invariant 3)', () => {
  const at = (i: number) => new Date(Date.UTC(2026, 8, 18, 12, i)).toISOString();
  const fast = (i: number): Attempt => ({ factId: TierId.TwoByOne, answer: 1, correct: true, durationMs: 5000, at: at(i), encounterId: 'e', outcome: 'critical' });

  it('needs five fast correct Attempts in a row; a table Fact still needs three', () => {
    expect(TIER_MASTERY_STREAK).toBe(5);
    expect(masteryStreakFor('md:2x1')).toBe(5);
    expect(masteryStreakFor('tt:7x8')).toBe(3);
    expect(masteryStreakFor('tt:0x8')).toBe(1);
    const four = [0, 1, 2, 3].map(fast);
    expect(factStatus(four, 20000, masteryStreakFor('md:2x1')).state).toBe('learning');
    expect(factStatus([...four, fast(4)], 20000, masteryStreakFor('md:2x1')).state).toBe('mastered');
  });
});
