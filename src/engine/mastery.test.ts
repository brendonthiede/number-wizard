import { describe, expect, it } from 'vitest';
import { factStatus, isDue, statusByFact, TIMES_TABLE_THRESHOLD_MS } from './mastery';
import type { Attempt } from './types';

const T0 = Date.parse('2026-09-15T12:00:00.000Z');
const DAY = 86_400_000;

const attempt = (i: number, over: Partial<Attempt> = {}): Attempt => ({
  factId: 'tt:3x4',
  answer: 12,
  correct: true,
  durationMs: 2000,
  at: new Date(T0 + i * 1000).toISOString(),
  encounterId: 'e1',
  ...over,
});

describe('factStatus', () => {
  it('is Learning with no Attempts', () => {
    expect(factStatus([], TIMES_TABLE_THRESHOLD_MS)).toEqual({ state: 'learning', streak: 0, dueAt: null });
  });

  it('is Mastered after three fast correct Attempts, Due one day later', () => {
    const s = factStatus([attempt(0), attempt(1), attempt(2)], TIMES_TABLE_THRESHOLD_MS);
    expect(s.state).toBe('mastered');
    expect(s.streak).toBe(3);
    expect(s.dueAt).toBe(new Date(T0 + 2000 + 1 * DAY).toISOString());
  });

  it('stretches the Due interval 1, 3, 7, 14, 30 days and caps at 30', () => {
    const days = (n: number) => {
      const s = factStatus(Array.from({ length: n }, (_, i) => attempt(i)), TIMES_TABLE_THRESHOLD_MS);
      return (Date.parse(s.dueAt!) - (T0 + (n - 1) * 1000)) / DAY;
    };
    expect([3, 4, 5, 6, 7, 8, 12].map(days)).toEqual([1, 3, 7, 14, 30, 30, 30]);
  });

  it('returns to Learning on a Miss', () => {
    const s = factStatus([attempt(0), attempt(1), attempt(2), attempt(3, { correct: false, answer: 11 })], TIMES_TABLE_THRESHOLD_MS);
    expect(s).toEqual({ state: 'learning', streak: 0, dueAt: null });
  });

  it('returns to Learning on a slow correct Attempt', () => {
    const s = factStatus([attempt(0), attempt(1), attempt(2), attempt(3, { durationMs: 4000 })], TIMES_TABLE_THRESHOLD_MS);
    expect(s.state).toBe('learning');
  });

  it('only counts the streak since the last Miss', () => {
    const s = factStatus([attempt(0, { correct: false }), attempt(1), attempt(2), attempt(3)], TIMES_TABLE_THRESHOLD_MS);
    expect(s).toMatchObject({ state: 'mastered', streak: 3 });
  });
});

describe('isDue', () => {
  it('is false for Learning Facts and future dates, true once the date arrives', () => {
    expect(isDue({ state: 'learning', streak: 0, dueAt: null }, new Date(T0))).toBe(false);
    const due = { state: 'mastered' as const, streak: 3, dueAt: new Date(T0 + DAY).toISOString() };
    expect(isDue(due, new Date(T0))).toBe(false);
    expect(isDue(due, new Date(T0 + DAY))).toBe(true);
  });
});

describe('statusByFact', () => {
  it('groups Attempts by Fact in order', () => {
    const attempts = [attempt(0), attempt(1, { factId: 'tt:5x5', answer: 25 }), attempt(2), attempt(3)];
    const s = statusByFact(attempts, TIMES_TABLE_THRESHOLD_MS);
    expect(s['tt:3x4']?.state).toBe('mastered');
    expect(s['tt:5x5']?.streak).toBe(1);
  });
});
