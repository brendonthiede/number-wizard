import { factId } from './timesTable';
import type { FactId, FactStatus, TimesTableFact } from './types';

export const ROW_ORDER = [0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12];
const MAX_OPEN = 2;
const COMPLETE_AT = Math.ceil(13 * 0.8); // 11 of 13

export const rowFactIds = (n: number): FactId[] => Array.from({ length: 13 }, (_, i) => factId(n, i));

export function openRows(status: Record<FactId, FactStatus>): number[] {
  const complete = (n: number) => rowFactIds(n).filter((id) => status[id]?.state === 'mastered').length >= COMPLETE_AT;
  return ROW_ORDER.filter((n) => !complete(n)).slice(0, MAX_OPEN);
}

export const inRows = (fact: TimesTableFact, rows: number[]): boolean =>
  rows.includes(fact.a) || rows.includes(fact.b);
