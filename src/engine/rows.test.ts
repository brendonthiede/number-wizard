import { describe, expect, it } from 'vitest';
import { factId } from './timesTable';
import { inRows, openRows, ROW_ORDER, rowFactIds } from './rows';
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

  it('opens the first two rows with nothing Mastered', () => {
    expect(openRows({})).toEqual([0, 1]);
  });

  it('a row completes at 80% Mastered (11 of 13) and the next opens', () => {
    expect(openRows(masteredRow(0, 10))).toEqual([0, 1]);
    expect(openRows(masteredRow(0, 11))).toEqual([1, 2]);
  });

  it('opens nothing when every row is complete', () => {
    const all = Object.assign({}, ...ROW_ORDER.map((n) => masteredRow(n)));
    expect(openRows(all)).toEqual([]);
  });

  it('a Fact is in the open rows if either operand is', () => {
    const f = { id: factId(3, 7), skill: 'times-table' as const, a: 3, b: 7 };
    expect(inRows(f, [7, 8])).toBe(true);
    expect(inRows(f, [3, 8])).toBe(true);
    expect(inRows(f, [1, 2])).toBe(false);
  });
});
