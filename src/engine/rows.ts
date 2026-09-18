import { factId, parseFactId } from './timesTable';
import { MasteryState, type FactId, type FactStatus, type TimesTableFact } from './types';

export const ROW_ORDER = [0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12];

// 0 × n and 1 × n are rules, not Facts to memorise: drilling each three times kept a new Player on
// zeros for the first 60-plus Attempts. One fast correct Attempt masters them.
export const WARM_UP_ROWS = [0, 1];
const WARM_UP_STREAK = 1;
const FULL_STREAK = 3;

/** How many fast correct Attempts in a row master this Fact: 1 in a warm-up row, 3 elsewhere. */
export function masteryStreakFor(id: FactId): number {
  const operands = parseFactId(id);
  return operands && operands.some((n) => WARM_UP_ROWS.includes(n)) ? WARM_UP_STREAK : FULL_STREAK;
}
const MAX_OPEN = 2;
/** A row completes, and its Achievement is earned, at 80% of its 13 Facts Mastered: 11. */
export const ROW_COMPLETE_AT = Math.ceil(13 * 0.8);

export const rowFactIds = (n: number): FactId[] => Array.from({ length: 13 }, (_, i) => factId(n, i));

// A row, once introduced, stays eligible: dropping completed rows orphaned their last Facts.
export function introducedRows(status: Record<FactId, FactStatus>): number[] {
  const complete = (n: number) => rowFactIds(n).filter((id) => status[id]?.state === MasteryState.Mastered).length >= ROW_COMPLETE_AT;
  const rows: number[] = [];
  let incomplete = 0;
  for (const n of ROW_ORDER) {
    if (incomplete >= MAX_OPEN) break;
    rows.push(n);
    if (!complete(n)) incomplete++;
  }
  return rows;
}

export const inRows = (fact: TimesTableFact, rows: number[]): boolean =>
  rows.includes(fact.a) || rows.includes(fact.b);
