import { MasteryState, Outcome, type Attempt, type FactId, type FactStatus } from './types';

export const TIMES_TABLE_THRESHOLD_MS = 4000;
const MASTERY_STREAK = 3;
const SCHEDULE_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 86_400_000;

/** `attempts` are for one Fact, oldest first. */
export function factStatus(attempts: Attempt[], thresholdMs: number, streakRequired: number = MASTERY_STREAK): FactStatus {
  // One counter for mastery and the Due schedule: a slow correct Attempt restarts the interval too.
  // Conservative by choice; the spec resets only on a Miss.
  let streak = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i]!;
    // A Glancing Blow (right answer, wrong Work) never counts toward Mastery (issue #1).
    if (!a.correct || a.outcome === Outcome.Glancing || a.durationMs >= thresholdMs) break;
    streak++;
  }
  if (streak < streakRequired) return { state: MasteryState.Learning, streak, dueAt: null };
  const last = attempts[attempts.length - 1]!;
  const days = SCHEDULE_DAYS[Math.min(streak - streakRequired, SCHEDULE_DAYS.length - 1)]!;
  return { state: MasteryState.Mastered, streak, dueAt: new Date(Date.parse(last.at) + days * DAY_MS).toISOString() };
}

export const isDue = (status: FactStatus, now: Date): boolean =>
  status.dueAt !== null && Date.parse(status.dueAt) <= now.getTime();

/** `attempts` must be oldest first; SaveData.attempts is append-only so this holds. */
export function statusByFact(
  attempts: Attempt[], thresholdMs: number, streakFor: (id: FactId) => number = () => MASTERY_STREAK,
): Record<FactId, FactStatus> {
  const grouped: Record<FactId, Attempt[]> = {};
  for (const a of attempts) (grouped[a.factId] ??= []).push(a);
  return Object.fromEntries(Object.entries(grouped).map(([id, list]) => [id, factStatus(list, thresholdMs, streakFor(id))]));
}
