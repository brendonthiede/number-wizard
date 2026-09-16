import type { EncounterTemplate } from '../content';
import { levelForXp, maxHpForLevel } from '../engine/character';
import { castSpell, rollLoot, servedFacts, startEncounter, EncounterStatus, type Encounter, type EncounterSpec } from '../engine/combat';
import { statusByFact, TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { inRows, introducedRows } from '../engine/rows';
import { buildPools, factWeight, pickFact } from '../engine/select';
import { timesTableFacts, timesTableProblem } from '../engine/timesTable';
import type { Attempt, Outcome, Problem } from '../engine/types';
import { withActiveEncounter, withAttempt, withEncounter, type SaveData } from '../storage/save';

export type { EncounterTemplate };

const FACTS = timesTableFacts();

export function beginEncounter(
  // Plain http on a LAN has no crypto.randomUUID; fall back to a still-unique-enough id.
  save: SaveData, template: EncounterTemplate, now: Date,
  id: string = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): { save: SaveData; encounter: Encounter } {
  const spec: EncounterSpec = { id, questId: template.questId, monsterId: template.monsterId, monsterMaxHp: template.monsterMaxHp };
  const encounter = startEncounter(spec, maxHpForLevel(levelForXp(save.character.xp)), now);
  return { save: withActiveEncounter(save, encounter), encounter };
}

export function nextProblem(save: SaveData, encounter: Encounter, now: Date, rng: () => number = Math.random): Problem {
  const status = statusByFact(save.attempts, TIMES_TABLE_THRESHOLD_MS);
  const rows = introducedRows(status);
  const pools = buildPools(FACTS, status, (f) => inRows(f, rows), now);
  const byFact: Record<string, Attempt[]> = {};
  for (const a of save.attempts) (byFact[a.factId] ??= []).push(a);
  const fact = pickFact(pools, (f) => factWeight(byFact[f.id] ?? [], false), servedFacts(encounter), rng);
  // 91 Facts and pickFact's exhausted-pool fallback make null unreachable.
  if (!fact) throw new Error('No Fact to serve');
  return timesTableProblem(fact, rng);
}

export function cast(
  save: SaveData, encounter: Encounter, template: EncounterTemplate, problem: Problem,
  answer: number | null, durationMs: number, now: Date, rng: () => number = Math.random,
): { save: SaveData; encounter: Encounter; outcome: Outcome } {
  // Times-table Problems have no Work.
  const next = castSpell(encounter, { factId: problem.factId, answer, correct: answer === problem.answer, workCorrect: true, durationMs }, TIMES_TABLE_THRESHOLD_MS, now);
  const attempt = next.spells[next.spells.length - 1]!;
  const data = withAttempt(save, attempt);
  return {
    save: next.status === EncounterStatus.Active ? withActiveEncounter(data, next) : withEncounter(data, next, rollLoot(template.lootPool, rng)),
    encounter: next,
    outcome: attempt.outcome,
  };
}

export const levelUp = (xpBefore: number, xpAfter: number): boolean => levelForXp(xpAfter) > levelForXp(xpBefore);
