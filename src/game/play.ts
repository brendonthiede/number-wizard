import type { EncounterTemplate } from '../content';
import { findTemplate } from '../content/quest1';
import { levelForXp, maxHpForLevel } from '../engine/character';
import { castSpell, servedFacts, startEncounter, EncounterStatus, type Encounter, type EncounterSpec } from '../engine/combat';
import { statusByFact } from '../engine/mastery';
import { isWorkCorrect, multiDigitProblem, openTiers, TIERS } from '../engine/multiDigit';
import { inRows, introducedRows, masteryStreakFor } from '../engine/rows';
import { buildPools, factWeight, pickFact } from '../engine/select';
import { timesTableFacts, timesTableProblem } from '../engine/timesTable';
import { Outcome, Skill, type Attempt, type Fact, type Problem } from '../engine/types';
import { withActiveEncounter, withAttempt, withEncounter, type SaveData } from '../storage/save';
import { isEmphasized, nextExplicitProblem, scaledHp, thresholdFor } from './learningPlan';
import { rollLootFor } from './loot';

export type { EncounterTemplate };

const FACTS = timesTableFacts();

/** Starts an Encounter for `template`, scaling the monster's HP by the Learning Plan in force. */
export function beginEncounter(
  // Plain http on a LAN has no crypto.randomUUID; fall back to a still-unique-enough id.
  save: SaveData, template: EncounterTemplate, now: Date,
  id: string = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): { save: SaveData; encounter: Encounter } {
  const spec: EncounterSpec = { id, questId: template.questId, monsterId: template.monsterId, monsterMaxHp: scaledHp(save, template.monsterMaxHp) };
  const encounter = startEncounter(spec, maxHpForLevel(levelForXp(save.character.xp)), now);
  return { save: withActiveEncounter(save, encounter), encounter };
}

// One Spell in five of a multi-digit Encounter is table Review, while any table Fact still needs it.
export const REVIEW_SHARE = 0.2;

/** What the Work grid hands to `cast`: the Work cells as entered, and whether the Work labels were ever visible. */
export interface GridEntry {
  entered: (number | null)[];
  labelsShown: boolean;
}

/**
 * Selects the next Problem for this Encounter. A Learning Plan's explicit Problems come first. A
 * multi-digit Encounter then serves an open Tier, or table Review one time in five while a table
 * Fact is Due or in Learning. Every other Encounter serves the table only, so Quest 1 and Survival
 * never show a Work grid.
 */
export function nextProblem(save: SaveData, encounter: Encounter, now: Date, rng: () => number = Math.random): Problem {
  const served = servedFacts(encounter);
  const explicit = nextExplicitProblem(save, served);
  if (explicit) return explicit;
  const status = statusByFact(save.attempts, (id) => thresholdFor(save, id), masteryStreakFor);
  const byFact: Record<string, Attempt[]> = {};
  for (const a of save.attempts) (byFact[a.factId] ??= []).push(a);
  const weight = (f: Fact) => factWeight(byFact[f.id] ?? [], isEmphasized(save, f.id));
  const rows = introducedRows(status);
  const tablePools = buildPools(FACTS, status, (f) => inRows(f, rows), now);

  const skill = findTemplate(encounter.spec.questId, encounter.spec.monsterId)?.skill ?? Skill.TimesTable;
  if (skill === Skill.MultiDigit) {
    const reviewWanted = tablePools.due.length + tablePools.learning.length > 0;
    if (!(reviewWanted && rng() < REVIEW_SHARE)) {
      const open = openTiers(status);
      // With three Tiers the no-repeat rule runs out at once; pickFact then repeats in priority order.
      const tier = pickFact(buildPools(TIERS, status, (t) => open.includes(t), now), weight, served, rng);
      if (!tier) throw new Error('No Tier to serve');
      return multiDigitProblem(tier, rng);
    }
  }
  const fact = pickFact(tablePools, weight, served, rng);
  // 91 Facts and pickFact's exhausted-pool fallback make null unreachable.
  if (!fact) throw new Error('No Fact to serve');
  return timesTableProblem(fact, rng);
}

/**
 * Casts one Spell and returns the new save and Encounter. A Problem with Work is a Glancing Blow
 * unless every Work cell in `grid` is right; a missing `grid` counts as empty Work.
 */
export function cast(
  save: SaveData, encounter: Encounter, template: EncounterTemplate, problem: Problem,
  answer: number | null, durationMs: number, now: Date, rng: () => number = Math.random, grid?: GridEntry,
): { save: SaveData; encounter: Encounter; outcome: Outcome } {
  const entered = grid?.entered ?? [];
  const next = castSpell(encounter, {
    factId: problem.factId, answer, correct: answer === problem.answer, workCorrect: isWorkCorrect(problem, entered), durationMs,
    ...(problem.work && { operands: problem.operands, work: entered, labelsShown: grid?.labelsShown ?? true }),
  }, thresholdFor(save, problem.factId), now);
  const attempt = next.spells[next.spells.length - 1]!;
  const data = withAttempt(save, attempt);
  return {
    save: next.status === EncounterStatus.Active ? withActiveEncounter(data, next) : withEncounter(data, next, rollLootFor(data, template.lootPool, rng)),
    encounter: next,
    outcome: attempt.outcome,
  };
}

/** Whether the result screen should suggest hiding the Work labels: a win where they were shown and all Work was right. */
export const shouldNudgeLabels = (encounter: Encounter): boolean =>
  encounter.status === EncounterStatus.Won
  && encounter.spells.some((s) => s.work !== undefined && s.labelsShown !== false)
  && !encounter.spells.some((s) => s.outcome === Outcome.Glancing);

/** Whether XP moving from `xpBefore` to `xpAfter` crosses into a new level. */
export const levelUp = (xpBefore: number, xpAfter: number): boolean => levelForXp(xpAfter) > levelForXp(xpBefore);
