import { describe, expect, it } from 'vitest';
import { EncounterState, nextOpenIndex, openQuests, questComplete, questOpen, questProgress } from './quest';
import { beginEncounter, cast, nextProblem } from './play';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { PLAN_KIND, parseLearningPlan } from './learningPlan';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, withLearningPlan, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const record = (monsterId: string, status: EncounterRecord['status'], questId = QUEST_1.id): EncounterRecord => ({
  id: `${monsterId}-${status}`, questId, monsterId, monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status, xp: 0, loot: null,
});
const withRecords = (...records: EncounterRecord[]): SaveData => ({ ...base(), encounters: records });

describe('questProgress', () => {
  it('opens only the first Encounter for a new Player', () => {
    expect(questProgress(base(), QUEST_1)).toEqual([
      EncounterState.Open, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked,
    ]);
    expect(nextOpenIndex(base(), QUEST_1)).toBe(0);
    expect(questComplete(base(), QUEST_1)).toBe(false);
  });

  it('a won Encounter stays Won and opens the next', () => {
    const save = withRecords(record('gob-nine', EncounterStatus.Won));
    expect(questProgress(save, QUEST_1).slice(0, 3)).toEqual([EncounterState.Won, EncounterState.Open, EncounterState.Locked]);
    expect(nextOpenIndex(save, QUEST_1)).toBe(1);
  });

  it('ignores Retreats and records from another Quest', () => {
    const save = withRecords(record('gob-nine', EncounterStatus.Retreated), record('gob-nine', EncounterStatus.Won, 'another-quest'));
    expect(questProgress(save, QUEST_1)[0]).toBe(EncounterState.Open);
  });

  it('is complete only when the boss is won, and then focuses the boss', () => {
    const allButBoss = withRecords(...QUEST_1.encounters.slice(0, 6).map((e) => record(e.monsterId, EncounterStatus.Won)));
    expect(questComplete(allButBoss, QUEST_1)).toBe(false);
    expect(nextOpenIndex(allButBoss, QUEST_1)).toBe(6);
    const all = withRecords(...QUEST_1.encounters.map((e) => record(e.monsterId, EncounterStatus.Won)));
    expect(questComplete(all, QUEST_1)).toBe(true);
    expect(questProgress(all, QUEST_1).every((s) => s === EncounterState.Won)).toBe(true);
    expect(nextOpenIndex(all, QUEST_1)).toBe(6);
  });
});

describe('playing the Quest in order through play.ts (invariant 1)', () => {
  it('opens each Encounter exactly when the previous is won and completes on the boss', () => {
    let save = base();
    const rng = () => 0.5;
    QUEST_1.encounters.forEach((template, i) => {
      expect(questProgress(save, QUEST_1)[i]).toBe(EncounterState.Open);
      let { save: s, encounter } = beginEncounter(save, template, NOW, `q${i}`);
      save = s;
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, NOW, rng);
        ({ save, encounter } = cast(save, encounter, template, p, p.answer, 1000, NOW, rng));
      }
      expect(encounter.status).toBe(EncounterStatus.Won);
      expect(questProgress(save, QUEST_1)[i]).toBe(EncounterState.Won);
      if (i < 6) expect(questProgress(save, QUEST_1)[i + 1]).toBe(EncounterState.Open);
    });
    expect(questComplete(save, QUEST_1)).toBe(true);
  });
});

describe('questOpen', () => {
  const NOW = new Date('2026-09-18T12:00:00Z');
  const wonAll = (): SaveData => ({
    ...emptySave('noah'),
    encounters: QUEST_1.encounters.map((e) => ({
      id: e.monsterId, questId: QUEST_1.id, monsterId: e.monsterId, monsterMaxHp: e.monsterMaxHp,
      startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status: 'won' as const, xp: 1, loot: null,
    })),
  });

  it('always opens Quest 1, and Quest 2 only once Quest 1 is complete', () => {
    expect(openQuests(emptySave('noah'))).toEqual([QUEST_1]);
    const almost = { ...wonAll(), encounters: wonAll().encounters.slice(0, 6) };
    expect(questOpen(almost, QUEST_2)).toBe(false);
    expect(openQuests(wonAll())).toEqual([QUEST_1, QUEST_2]);
  });

  it('opens Quest 2 early when the Learning Plan unlocks its Skill', () => {
    const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, unlockedSkills: ['multi-digit-multiplication'] });
    expect(questOpen(withLearningPlan(emptySave('noah'), plan, NOW), QUEST_2)).toBe(true);
    const other = parseLearningPlan({ kind: PLAN_KIND, version: 1, unlockedSkills: ['powers'] });
    expect(questOpen(withLearningPlan(emptySave('noah'), other, NOW), QUEST_2)).toBe(false);
  });
});
