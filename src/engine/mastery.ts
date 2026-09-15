import type { Attempt, FactId, FactStatus } from './types';

export const TIMES_TABLE_THRESHOLD_MS = 4000;
const MASTERY_STREAK = 3;
const SCHEDULE_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 86_400_000;

/** `attempts` are for one Fact, oldest first. */
export function factStatus(attempts: Attempt[], thresholdMs: number): FactStatus {
  let streak = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i]!;
    if (!a.correct || a.durationMs >= thresholdMs) break;
    streak++;
  }
  if (streak < MASTERY_STREAK) return { state: 'learning', streak, dueAt: null };
  const last = attempts[attempts.length - 1]!;
  const days = SCHEDULE_DAYS[Math.min(streak - MASTERY_STREAK, SCHEDULE_DAYS.length - 1)]!;
  return { state: 'mastered', streak, dueAt: new Date(Date.parse(last.at) + days * DAY_MS).toISOString() };
}

export const isDue = (status: FactStatus, now: Date): boolean =>
  status.dueAt !== null && Date.parse(status.dueAt) <= now.getTime();

export function statusByFact(attempts: Attempt[], thresholdMs: number): Record<FactId, FactStatus> {
  const grouped: Record<FactId, Attempt[]> = {};
  for (const a of attempts) (grouped[a.factId] ??= []).push(a);
  return Object.fromEntries(Object.entries(grouped).map(([id, list]) => [id, factStatus(list, thresholdMs)]));
}
