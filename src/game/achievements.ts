import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { factStatus } from '../engine/mastery';
import { masteryStreakFor, ROW_COMPLETE_AT, rowFactIds } from '../engine/rows';
import { parseFactId, timesTableFacts } from '../engine/timesTable';
import { MasteryState, Outcome, type Attempt, type FactId } from '../engine/types';
import type { SaveData } from '../storage/save';
import { achievementThresholdFor } from './learningPlan';
import { questComplete } from './quest';

/** One trophy-case entry: earned when `earnedAt` is set. */
export interface Achievement {
  id: string;
  name: string;
  hint: string;
  earnedAt: string | null;
}

const Id = {
  FirstHit: 'first-hit', FirstCritical: 'first-critical', FiveCriticals: 'five-criticals', Flawless: 'flawless-encounter',
  Skill: 'skill-times-table', FirstQuest: 'first-quest',
} as const;
const rowId = (n: number) => `row-${n}`;
const ROW_NAMES = ['The Zeros', 'The Ones', 'The Twos', 'The Threes', 'The Fours', 'The Fives', 'The Sixes', 'The Sevens', 'The Eights', 'The Nines', 'The Tens', 'The Elevens', 'The Twelves'];
const FIVE = 5;
const TABLE_IDS = new Set(timesTableFacts().map((f) => f.id));
const TABLE_SIZE = TABLE_IDS.size;
// Indexed by row number; each Fact belongs to exactly the rows named by its two operands.
const ROW_FACTS = ROW_NAMES.map((_, n) => rowFactIds(n));

const DEFINITIONS: Omit<Achievement, 'earnedAt'>[] = [
  { id: Id.FirstHit, name: 'First Hit', hint: 'Land a Hit.' },
  { id: Id.FirstCritical, name: 'First Critical Hit', hint: 'Answer fast enough for a Critical Hit.' },
  { id: Id.FiveCriticals, name: 'Five Criticals', hint: 'Land five Critical Hits in one Encounter.' },
  { id: Id.Flawless, name: 'Flawless', hint: 'Win an Encounter without a Miss.' },
  ...ROW_NAMES.map((name, n) => ({ id: rowId(n), name, hint: `Master the ${n} times table row.` })),
  { id: Id.Skill, name: 'Times Table Master', hint: 'Master every Fact in the multiplication table.' },
  { id: Id.FirstQuest, name: 'Fortress Taken', hint: 'Finish the Fortress of Twelves.' },
];

/** How many Achievements exist; the Trophy Case shows this as the denominator. */
export const ACHIEVEMENT_COUNT = DEFINITIONS.length;

/**
 * Every Achievement with the moment it was first earned, derived in one pass over the save.
 * Attempts and records are append-only and in order, so the first satisfying event is the earliest.
 * Nothing is stored, so an Achievement follows the threshold in force: a stricter Learning Plan
 * never takes one away, but loosening a plan and later removing it can.
 */
export function achievements(save: SaveData): Achievement[] {
  const threshold = achievementThresholdFor(save);
  const earned = new Map<string, string>();
  const first = (id: string, atTime: string) => { if (!earned.has(id)) earned.set(id, atTime); };
  const byFact: Record<FactId, Attempt[]> = {};
  const mastered = new Set<FactId>();
  const criticals: Record<string, number> = {};
  const missed = new Set<string>();
  const rowsDone = new Set<number>();

  for (const a of save.attempts) {
    if (a.outcome === Outcome.Miss) missed.add(a.encounterId);
    if (a.outcome === Outcome.Hit || a.outcome === Outcome.Critical) first(Id.FirstHit, a.at);
    if (a.outcome === Outcome.Critical) {
      first(Id.FirstCritical, a.at);
      criticals[a.encounterId] = (criticals[a.encounterId] ?? 0) + 1;
      if (criticals[a.encounterId] === FIVE) first(Id.FiveCriticals, a.at);
    }
    // Mastery Achievements only ever come from the 91 generated table Facts: another Skill's id, an
    // out-of-range `tt:12x34`, or a non-canonical `tt:4x3` from a damaged save must never count or crash.
    const operands = TABLE_IDS.has(a.factId) ? parseFactId(a.factId) : null;
    if (operands) {
      (byFact[a.factId] ??= []).push(a);
      const status = factStatus(byFact[a.factId]!, threshold, masteryStreakFor(a.factId));
      if (status.state === MasteryState.Mastered) mastered.add(a.factId);
      else mastered.delete(a.factId);
      for (const n of new Set(operands)) {
        if (!rowsDone.has(n) && ROW_FACTS[n]!.filter((id) => mastered.has(id)).length >= ROW_COMPLETE_AT) {
          rowsDone.add(n);
          first(rowId(n), a.at);
        }
      }
      if (mastered.size === TABLE_SIZE) first(Id.Skill, a.at);
    }
  }

  for (const r of save.encounters) {
    if (r.status === EncounterStatus.Won && !missed.has(r.id)) first(Id.Flawless, r.endedAt);
  }
  if (questComplete(save, QUEST_1)) {
    const boss = QUEST_1.encounters[QUEST_1.encounters.length - 1]!;
    const win = save.encounters.find((r) => r.questId === QUEST_1.id && r.monsterId === boss.monsterId && r.status === EncounterStatus.Won);
    if (win) first(Id.FirstQuest, win.endedAt);
  }

  return DEFINITIONS.map((d) => ({ ...d, earnedAt: earned.get(d.id) ?? null }));
}

/** The Achievements earned between two saves: unearned before, earned after. */
export function newlyEarned(before: SaveData, after: SaveData): Achievement[] {
  const was = new Set(achievements(before).filter((a) => a.earnedAt !== null).map((a) => a.id));
  return achievements(after).filter((a) => a.earnedAt !== null && !was.has(a.id));
}
