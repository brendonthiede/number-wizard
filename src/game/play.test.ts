import { describe, expect, it, vi } from 'vitest';
import { beginEncounter, cast, levelUp, nextProblem } from './play';
import { QUEST_1_FIRST, type EncounterTemplate } from '../content';
import { EncounterStatus, servedFacts } from '../engine/combat';
import { levelForXp, LEVEL_XP, maxHpForLevel } from '../engine/character';
import { Outcome } from '../engine/types';
import { emptySave, type SaveData } from '../storage/save';
import { introducedRows, masteryStreakFor } from '../engine/rows';
import { statusByFact, TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';

const NOW = new Date('2026-09-16T12:00:00.000Z');
let seed = 7;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const withXp = (xp: number): SaveData => ({ ...emptySave('noah'), character: { name: 'Noah', portrait: 'character-01', xp, survivalBest: 0 } });

describe('beginEncounter', () => {
  it('starts the Encounter from the template, stores it as activeEncounter, and uses the given id', () => {
    const { save, encounter } = beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');
    expect(encounter.spec).toEqual({ id: 'e1', questId: 'fortress-of-twelves', monsterId: 'gob-nine', monsterMaxHp: 6 });
    expect(encounter.status).toBe(EncounterStatus.Active);
    expect(save.activeEncounter).toEqual(encounter);
  });

  it('always starts the Character at the max HP for their Level (invariant 2)', () => {
    for (const xp of [0, 19, 20, 100, 480, 1750, 5000]) {
      const { encounter } = beginEncounter(withXp(xp), QUEST_1_FIRST, NOW, 'e1');
      expect(encounter.characterHp).toBe(maxHpForLevel(levelForXp(xp)));
      expect(encounter.characterMaxHp).toBe(encounter.characterHp);
    }
  });

  it('generates a unique id when none is given', () => {
    const a = beginEncounter(withXp(0), QUEST_1_FIRST, NOW).encounter.spec.id;
    const b = beginEncounter(withXp(0), QUEST_1_FIRST, NOW).encounter.spec.id;
    expect(a).not.toBe(b);
  });

  it('still generates an id when crypto.randomUUID is unavailable (F7)', () => {
    vi.stubGlobal('crypto', undefined);
    const id = beginEncounter(withXp(0), QUEST_1_FIRST, NOW).encounter.spec.id;
    expect(id).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe('nextProblem', () => {
  it('serves only introduced rows (0 and 1) to a new Player', () => {
    const { save, encounter } = beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');
    for (let i = 0; i < 30; i++) {
      const p = nextProblem(save, encounter, NOW, rng);
      const [a, b] = p.prompt.split(' × ').map(Number);
      expect(a === 0 || a === 1 || b === 0 || b === 1).toBe(true);
      expect(p.answer).toBe(a! * b!);
    }
  });

  it('never repeats a Fact within an Encounter while unserved Facts remain', () => {
    let { save, encounter } = beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');
    const served: string[] = [];
    while (encounter.status === EncounterStatus.Active) {
      const p = nextProblem(save, encounter, NOW, rng);
      expect(servedFacts(encounter).has(p.factId)).toBe(false);
      served.push(p.factId);
      ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, null, 1000, NOW, rng)); // Miss every time
    }
    expect(new Set(served).size).toBe(served.length);
  });
});

describe('cast', () => {
  const start = () => beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');

  it('a fast correct answer is a Critical Hit: Attempt appended, live Encounter updated', () => {
    const { save, encounter } = start();
    const p = nextProblem(save, encounter, NOW, rng);
    const r = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, rng);
    expect(r.outcome).toBe(Outcome.Critical);
    expect(r.encounter.monsterHp).toBe(4);
    expect(r.save.attempts).toHaveLength(1);
    expect(r.save.attempts[0]).toMatchObject({ factId: p.factId, answer: p.answer, correct: true, encounterId: 'e1', outcome: Outcome.Critical });
    expect(r.save.activeEncounter).toEqual(r.encounter);
  });

  it('a wrong answer is a Miss and costs a heart', () => {
    const { save, encounter } = start();
    const p = nextProblem(save, encounter, NOW, rng);
    const r = cast(save, encounter, QUEST_1_FIRST, p, p.answer + 1, 1000, NOW, rng);
    expect(r.outcome).toBe(Outcome.Miss);
    expect(r.encounter.characterHp).toBe(4);
  });

  it('records the Encounter with Loot from the template pool when it is won', () => {
    const template: EncounterTemplate = { ...QUEST_1_FIRST, monsterMaxHp: 2, lootPool: ['hat'] };
    const { save, encounter } = beginEncounter(withXp(0), template, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, rng);
    const r = cast(save, encounter, template, p, p.answer, 1000, NOW, rng);
    expect(r.encounter.status).toBe(EncounterStatus.Won);
    expect(r.save.activeEncounter).toBeNull();
    expect(r.save.encounters).toHaveLength(1);
    expect(r.save.encounters[0]).toMatchObject({ id: 'e1', status: EncounterStatus.Won, xp: 4, loot: 'hat' });
    expect(r.save.character.xp).toBe(4);
  });
});

describe('levelUp', () => {
  it('is true only when the Level grew', () => {
    expect(levelUp(0, LEVEL_XP[0]! - 1)).toBe(false);
    expect(levelUp(0, LEVEL_XP[0]!)).toBe(true);
    expect(levelUp(LEVEL_XP[0]!, LEVEL_XP[0]! + 5)).toBe(false);
  });
});

describe('warm-up rows', () => {
  it('a perfect Player leaves the 0 and 1 rows behind within 30 Attempts and then meets other numbers', () => {
    let save = withXp(0);
    let t = NOW.getTime();
    let attempts = 0;
    const playOne = (id: string) => {
      t += 3_600_000;
      let { save: s, encounter } = beginEncounter(save, QUEST_1_FIRST, new Date(t), id);
      save = s;
      const prompts: string[] = [];
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, new Date(t), rng);
        prompts.push(p.prompt);
        ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1500, new Date(t + ++attempts * 5000), rng));
      }
      return prompts;
    };
    const rowsOpen = () => introducedRows(statusByFact(save.attempts, TIMES_TABLE_THRESHOLD_MS, masteryStreakFor));
    for (let i = 0; i < 20 && rowsOpen().length < 3; i++) playOne(`w${i}`);
    expect(rowsOpen().length, `rows open after ${attempts} Attempts: ${rowsOpen().join(',')}`).toBeGreaterThanOrEqual(3);
    expect(attempts).toBeLessThanOrEqual(30);
    const next = playOne('after');
    const beyond = next.filter((prompt) => prompt.split(' × ').map(Number).every((n) => n > 1));
    expect(beyond.length, `Problems without a 0 or 1 in the next Encounter: ${next.join('; ')}`).toBeGreaterThan(0);
  });
});

describe('playthrough through play.ts (invariant 1)', () => {
  it('keeps XP equal to the recorded sum, resolves every Attempt, never starves', () => {
    let save = withXp(0);
    let t = NOW.getTime();
    for (let i = 0; i < 100; i++) {
      t += 43_200_000;
      let { save: s, encounter } = beginEncounter(save, QUEST_1_FIRST, new Date(t), `e${i}`);
      save = s;
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, new Date(t), rng);
        const answer = rng() < 0.8 ? p.answer : p.answer + 1;
        ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, answer, rng() < 0.8 ? 1500 : 6000, new Date(t), rng));
      }
      expect(save.activeEncounter).toBeNull();
    }
    expect(save.encounters).toHaveLength(100);
    expect(save.character.xp).toBe(save.encounters.reduce((sum, r) => sum + r.xp, 0));
    const ids = new Set(save.encounters.map((r) => r.id));
    for (const a of save.attempts) expect(ids.has(a.encounterId)).toBe(true);
  });
});
