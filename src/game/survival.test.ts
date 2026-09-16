import { describe, expect, it } from 'vitest';
import { clockText, endRun, forfeitEncounter, recordRunEncounter, remainingMs, startRun, SURVIVAL_MS } from './survival';
import { beginEncounter, cast, nextProblem } from './play';
import { QUEST_1_FIRST } from '../content';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type SaveData } from '../storage/save';

const T0 = Date.parse('2026-09-16T12:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms);
const rng = () => 0.5;
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');

describe('a Survival run', () => {
  it('lasts five minutes from its start and counts down to zero, never below', () => {
    const run = startRun(at(0));
    expect(SURVIVAL_MS).toBe(300_000);
    expect(remainingMs(run, at(0))).toBe(SURVIVAL_MS);
    expect(remainingMs(run, at(299_000))).toBe(1_000);
    expect(remainingMs(run, at(300_000))).toBe(0);
    expect(remainingMs(run, at(400_000))).toBe(0);
  });

  it('shows the clock as m:ss, rounding up so it never reads 0:00 while time remains', () => {
    expect(clockText(300_000)).toBe('5:00');
    expect(clockText(299_001)).toBe('5:00');
    expect(clockText(61_000)).toBe('1:01');
    expect(clockText(999)).toBe('0:01');
    expect(clockText(0)).toBe('0:00');
  });

  it('counts a won Encounter and ignores a Retreat', () => {
    let run = startRun(at(0));
    let { save, encounter } = beginEncounter(base(), { ...QUEST_1_FIRST, monsterMaxHp: 1 }, at(0), 'e1');
    const p = nextProblem(save, encounter, at(0), rng);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, at(0), rng));
    expect(encounter.status).toBe(EncounterStatus.Won);
    run = recordRunEncounter(run, encounter);
    expect(run.wins).toBe(1);
    let lost = beginEncounter(save, QUEST_1_FIRST, at(0), 'e2');
    for (let i = 0; i < 5; i++) {
      const q = nextProblem(lost.save, lost.encounter, at(0), rng);
      lost = cast(lost.save, lost.encounter, QUEST_1_FIRST, q, null, 1000, at(0), rng);
    }
    expect(lost.encounter.status).toBe(EncounterStatus.Retreated);
    expect(recordRunEncounter(run, lost.encounter).wins).toBe(1);
  });
});

describe('forfeitEncounter at the clock', () => {
  it('records a fight with Spells cast as a Retreat, keeping its XP', () => {
    let { save, encounter } = beginEncounter(base(), QUEST_1_FIRST, at(0), 'e1');
    const p = nextProblem(save, encounter, at(0), rng);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, at(0), rng)); // Critical, 2 damage
    const after = forfeitEncounter(save, encounter);
    expect(after.activeEncounter).toBeNull();
    expect(after.encounters).toHaveLength(1);
    expect(after.encounters[0]).toMatchObject({ id: 'e1', status: EncounterStatus.Retreated, xp: 2, loot: null });
    expect(after.character.xp).toBe(2);
  });

  it('discards a fight with no Spell cast: no record, no orphaned Attempts', () => {
    const { save, encounter } = beginEncounter(base(), QUEST_1_FIRST, at(0), 'e1');
    const after = forfeitEncounter(save, encounter);
    expect(after.activeEncounter).toBeNull();
    expect(after.encounters).toHaveLength(0);
    expect(after.attempts).toHaveLength(0);
  });

  it('leaves a finished Encounter alone', () => {
    let { save, encounter } = beginEncounter(base(), { ...QUEST_1_FIRST, monsterMaxHp: 1 }, at(0), 'e1');
    const p = nextProblem(save, encounter, at(0), rng);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, at(0), rng));
    expect(forfeitEncounter(save, encounter)).toEqual(save);
  });
});

describe('endRun', () => {
  it('raises the survival best only when beaten and reports whether it did', () => {
    const save = { ...base(), character: { ...base().character, survivalBest: 2 } };
    const run = { ...startRun(at(0)), wins: 3 };
    const beaten = endRun(save, run);
    expect(beaten.save.character.survivalBest).toBe(3);
    expect(beaten.newBest).toBe(true);
    const notBeaten = endRun(beaten.save, { ...startRun(at(0)), wins: 1 });
    expect(notBeaten.save.character.survivalBest).toBe(3);
    expect(notBeaten.newBest).toBe(false);
  });
});
