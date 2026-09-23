import { describe, expect, it } from 'vitest';
import { REGIONS } from '../content/map';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { EncounterStatus } from '../engine/combat';
import { parseLearningPlan, PLAN_KIND } from './learningPlan';
import { completesQuest, fogLine, freeRoamTemplate, questFor, regionProgress, regionState } from './map';
import { emptySave, withCharacter, withLearningPlan, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-23T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const won = (questId: string, monsterId: string): EncounterRecord => ({
  id: `${questId}-${monsterId}`, questId, monsterId, monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(),
  status: EncounterStatus.Won, xp: 12, loot: null,
});
const withWins = (save: SaveData, questId: string, monsters: string[]): SaveData =>
  ({ ...save, encounters: [...save.encounters, ...monsters.map((m) => won(questId, m))] });
const quest1Done = (): SaveData => withWins(base(), QUEST_1.id, QUEST_1.encounters.map((e) => e.monsterId));
const [fortress, foundry, peak, delta] = REGIONS as [typeof REGIONS[0], typeof REGIONS[0], typeof REGIONS[0], typeof REGIONS[0]];

describe('regionState', () => {
  it('a new save: one Open region, three Fogged (invariant 3)', () => {
    expect(REGIONS.map((r) => regionState(base(), r))).toEqual(['open', 'fogged', 'fogged', 'fogged']);
  });

  it('Quest 1 complete: one Complete, one Open, two Fogged (invariant 3)', () => {
    expect(REGIONS.map((r) => regionState(quest1Done(), r))).toEqual(['complete', 'open', 'fogged', 'fogged']);
  });

  it('a Learning Plan that unlocks a Skill lifts Fog only where a Quest exists (invariant 2)', () => {
    const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, unlockedSkills: ['multi-digit-multiplication', 'powers', 'long-division'] });
    const save = withLearningPlan(base(), plan, NOW);
    expect(regionState(save, foundry)).toBe('open');
    expect(regionState(save, peak)).toBe('fogged');
    expect(regionState(save, delta)).toBe('fogged');
  });

  it('questFor resolves a region to its Quest, or undefined with none', () => {
    expect(questFor(fortress)).toBe(QUEST_1);
    expect(questFor(foundry)).toBe(QUEST_2);
    expect(questFor(peak)).toBeUndefined();
  });
});

describe('fogLine and regionProgress', () => {
  it('names the Guide for a locked Quest and says nothing lives in a region with none', () => {
    expect(fogLine(foundry)).toBe('The Guide holds the key.');
    expect(fogLine(peak)).toBe('Nothing lives here yet.');
  });

  it('counts won Encounters out of the Quest, or null with no Quest', () => {
    expect(regionProgress(base(), fortress)).toEqual({ won: 0, total: 7 });
    expect(regionProgress(withWins(base(), QUEST_1.id, ['gob-nine', 'fourmidable-knight', 'gob-nine']), fortress)).toEqual({ won: 2, total: 7 });
    expect(regionProgress(quest1Done(), fortress)).toEqual({ won: 7, total: 7 });
    expect(regionProgress(base(), peak)).toBeNull();
  });
});

describe('freeRoamTemplate (invariant 4)', () => {
  it('returns one of the Quest\'s own templates for every rng value, first at 0 and last just under 1', () => {
    expect(freeRoamTemplate(QUEST_1, () => 0)).toBe(QUEST_1.encounters[0]);
    expect(freeRoamTemplate(QUEST_1, () => 0.999999)).toBe(QUEST_1.encounters[6]);
    let seed = 5;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const t = freeRoamTemplate(QUEST_2, rng);
      expect(QUEST_2.encounters).toContain(t);
      seen.add(t.monsterId);
    }
    expect(seen.size).toBe(7);
  });

  it('is the template itself: the Quest id, the monster HP and its Loot pool, unchanged', () => {
    const t = freeRoamTemplate(QUEST_1, () => 0.5);
    expect(t).toBe(QUEST_1.encounters[3]);
    expect(t.questId).toBe(QUEST_1.id);
    expect(t.lootPool).toEqual(['bat-wing-cloak']);
  });
});

describe('completesQuest (invariant 6)', () => {
  const sixDone = () => withWins(base(), QUEST_1.id, QUEST_1.encounters.slice(0, 6).map((e) => e.monsterId));

  it('is true only for the win that completes the Quest', () => {
    const before = sixDone();
    const after = withWins(before, QUEST_1.id, ['twelve-headed-hydra']);
    expect(completesQuest(before, after, QUEST_1)).toBe(true);
    expect(completesQuest(after, withWins(after, QUEST_1.id, ['twelve-headed-hydra']), QUEST_1)).toBe(false);
    expect(completesQuest(before, withWins(before, QUEST_1.id, ['gob-nine']), QUEST_1)).toBe(false);
    expect(completesQuest(before, after, QUEST_2)).toBe(false);
  });
});
