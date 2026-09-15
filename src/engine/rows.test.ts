import { describe, expect, it } from 'vitest';
import { buildPools, pickFact } from './select';
import { factId, timesTableFacts } from './timesTable';
import { inRows, introducedRows, ROW_ORDER, rowFactIds } from './rows';
import type { FactId, FactStatus } from './types';

const mastered: FactStatus = { state: 'mastered', streak: 3, dueAt: null };
const masteredRow = (n: number, count = 13): Record<FactId, FactStatus> =>
  Object.fromEntries(rowFactIds(n).slice(0, count).map((id) => [id, mastered]));

describe('rows', () => {
  it('introduces rows easy-first', () => {
    expect(ROW_ORDER).toEqual([0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12]);
  });

  it('a row is the 13 Facts containing that number', () => {
    expect(rowFactIds(3)).toHaveLength(13);
    expect(rowFactIds(3)).toContain(factId(3, 7));
    expect(rowFactIds(3)).toContain(factId(3, 3));
  });

  it('introduces the first two rows with nothing Mastered', () => {
    expect(introducedRows({})).toEqual([0, 1]);
  });

  it('a row completes at 80% Mastered (11 of 13), opening the next row without dropping the completed one', () => {
    expect(introducedRows(masteredRow(0, 10))).toEqual([0, 1]);
    expect(introducedRows(masteredRow(0, 11))).toEqual([0, 1, 2]);
  });

  it('introduces every row, in order, when all are complete', () => {
    const all = Object.assign({}, ...ROW_ORDER.map((n) => masteredRow(n)));
    expect(introducedRows(all)).toEqual(ROW_ORDER);
  });

  it('a Fact is in the introduced rows if either operand is', () => {
    const f = { id: factId(3, 7), skill: 'times-table' as const, a: 3, b: 7 };
    expect(inRows(f, [7, 8])).toBe(true);
    expect(inRows(f, [3, 8])).toBe(true);
    expect(inRows(f, [1, 2])).toBe(false);
  });

  it('every Fact is served at least once for a learner who masters whatever is served', () => {
    const facts = timesTableFacts();
    const status: Record<FactId, FactStatus> = {};
    const now = new Date('2026-09-15T12:00:00.000Z');
    const rng = (() => {
      let x = 42;
      return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    })();
    for (let i = 0; i < 1000; i++) {
      const rows = introducedRows(status);
      const pools = buildPools(facts, status, (f) => inRows(f, rows), now);
      const next = pickFact(pools, () => 1, new Set(), rng);
      if (!next) break;
      status[next.id] = { state: 'mastered', streak: 3, dueAt: new Date(now.getTime() + 86_400_000).toISOString() };
    }
    expect(Object.keys(status)).toHaveLength(91);
  });
});
