import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_COUNT, achievements, newlyEarned } from './achievements';
import { beginEncounter, cast, nextProblem } from './play';
import { survivalRoster } from './survival';
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { statusByFact, TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { masteryStreakFor } from '../engine/rows';
import { factId, timesTableFacts } from '../engine/timesTable';
import { MasteryState, Outcome, type Attempt } from '../engine/types';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

const T0 = Date.parse('2026-09-17T12:00:00.000Z');
const at = (i: number) => new Date(T0 + i * 1000).toISOString();
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const attempt = (i: number, over: Partial<Attempt> = {}): Attempt => ({
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: at(i), encounterId: 'e1', outcome: Outcome.Critical, ...over,
});
const won = (id: string, endedAt: string, monsterId = 'gob-nine', questId = QUEST_1.id): EncounterRecord => ({
  id, questId, monsterId, monsterMaxHp: 6, startedAt: endedAt, endedAt, status: EncounterStatus.Won, xp: 12, loot: null,
});
const earnedIds = (save: SaveData) => achievements(save).filter((a) => a.earnedAt !== null).map((a) => a.id);
const byId = (save: SaveData, id: string) => achievements(save).find((a) => a.id === id)!;

describe('achievements', () => {
  it('lists exactly nineteen in table order with nothing earned for a new Player (invariant 1)', () => {
    const list = achievements(base());
    expect(list).toHaveLength(ACHIEVEMENT_COUNT);
    // The id list below is the source of truth for the count, not the design doc's "20" (see task-1-report.md).
    expect(ACHIEVEMENT_COUNT).toBe(19);
    expect(list.map((a) => a.id)).toEqual([
      'first-hit', 'first-critical', 'five-criticals', 'flawless-encounter',
      ...Array.from({ length: 13 }, (_, n) => `row-${n}`), 'skill-times-table', 'first-quest',
    ]);
    expect(list.every((a) => a.earnedAt === null)).toBe(true);
    const earnedList = achievements({ ...base(), attempts: [attempt(0)] });
    expect(earnedList.every((a) => a.earnedAt === null || !Number.isNaN(Date.parse(a.earnedAt)))).toBe(true);
    expect(byId(base(), 'row-9').name).toBe('The Nines');
    expect(byId(base(), 'row-9').hint).toBe('Master the 9 times table row.');
    expect(byId(base(), 'first-quest').name).toBe('Fortress Taken');
  });

  it('first Hit and first Critical Hit take the at of the first qualifying Attempt', () => {
    const save = { ...base(), attempts: [attempt(0, { outcome: Outcome.Miss, correct: false }), attempt(1, { outcome: Outcome.Hit, durationMs: 5000 }), attempt(2)] };
    expect(byId(save, 'first-hit').earnedAt).toBe(at(1));
    expect(byId(save, 'first-critical').earnedAt).toBe(at(2));
  });

  it('five Criticals must be in one Encounter (invariant 4)', () => {
    const split = { ...base(), attempts: [0, 1, 2].map((i) => attempt(i, { encounterId: 'a' })).concat([3, 4].map((i) => attempt(i, { encounterId: 'b' }))) };
    expect(byId(split, 'five-criticals').earnedAt).toBeNull();
    const together = { ...base(), attempts: [0, 1, 2, 3, 4, 5].map((i) => attempt(i)) };
    expect(byId(together, 'five-criticals').earnedAt).toBe(at(4));
  });

  it('Flawless needs a won record whose Attempts have no Miss', () => {
    const attempts = [attempt(0, { encounterId: 'e1', outcome: Outcome.Miss, correct: false }), attempt(1, { encounterId: 'e1' }), attempt(2, { encounterId: 'e2' })];
    const save = { ...base(), attempts, encounters: [won('e1', at(1)), won('e2', at(2))] };
    expect(byId(save, 'flawless-encounter').earnedAt).toBe(at(2));
  });

  it('row-0 needs 11 Facts Mastered under the warm-up rule; the whole table needs all 91 (invariant 5)', () => {
    const rowZero = Array.from({ length: 11 }, (_, i) => attempt(i, { factId: factId(0, i) }));
    const save = { ...base(), attempts: rowZero };
    expect(byId(save, 'row-0').earnedAt).toBe(at(10));
    expect(byId({ ...base(), attempts: rowZero.slice(0, 10) }, 'row-0').earnedAt).toBeNull();
    let i = 0;
    const all: Attempt[] = [];
    for (const f of timesTableFacts()) {
      const n = f.a <= 1 || f.b <= 1 ? 1 : 3;
      for (let k = 0; k < n; k++) all.push(attempt(i++, { factId: f.id }));
    }
    const mastered = { ...base(), attempts: all };
    expect(byId(mastered, 'skill-times-table').earnedAt).toBe(at(i - 1));
    expect(byId({ ...base(), attempts: all.slice(0, -1) }, 'skill-times-table').earnedAt).toBeNull();
    for (let n = 0; n <= 12; n++) expect(byId(mastered, `row-${n}`).earnedAt).not.toBeNull();
    const status = statusByFact(mastered.attempts, TIMES_TABLE_THRESHOLD_MS, masteryStreakFor);
    expect(timesTableFacts().every((f) => status[f.id]?.state === MasteryState.Mastered)).toBe(true);
  });

  it('an Attempt on a non-table Fact earns combat Achievements but never counts toward a row or Times Table Master', () => {
    let i = 0;
    const all: Attempt[] = [];
    for (const f of timesTableFacts()) {
      const n = f.a <= 1 || f.b <= 1 ? 1 : 3;
      for (let k = 0; k < n; k++) all.push(attempt(i++, { factId: f.id }));
    }
    const skillEarnedAt = byId({ ...base(), attempts: all }, 'skill-times-table').earnedAt;
    const extra = attempt(i, { factId: 'md:12x34' });
    const withExtra = { ...base(), attempts: [...all, extra] };
    expect(byId(withExtra, 'skill-times-table').earnedAt).toBe(skillEarnedAt);
    expect(earnedIds(withExtra)).toEqual(expect.arrayContaining(['first-hit', 'first-critical']));

    const ninetyMastered = { ...base(), attempts: [...all.slice(0, -1), extra] };
    expect(byId(ninetyMastered, 'skill-times-table').earnedAt).toBeNull();
  });

  it('Fortress Taken needs the boss won in the Quest, not in Survival', () => {
    const records = QUEST_1.encounters.map((e, i) => won(`q${i}`, at(i), e.monsterId));
    expect(byId({ ...base(), encounters: records }, 'first-quest').earnedAt).toBe(at(6));
    const survival = QUEST_1.encounters.map((e, i) => won(`s${i}`, at(i), e.monsterId, 'survival'));
    expect(byId({ ...base(), encounters: survival }, 'first-quest').earnedAt).toBeNull();
  });

  it('once earned stays earned across any prefix of history (invariant 2)', () => {
    const attempts = [attempt(0), attempt(1, { outcome: Outcome.Miss, correct: false }), attempt(2), attempt(3, { outcome: Outcome.Miss, correct: false })];
    const full = { ...base(), attempts, encounters: [won('e1', at(3))] };
    for (let k = 0; k <= attempts.length; k++) {
      const prefix = { ...base(), attempts: attempts.slice(0, k) };
      for (const a of achievements(prefix)) {
        if (a.earnedAt !== null) expect(byId(full, a.id).earnedAt).toBe(a.earnedAt);
      }
    }
  });

  it('a perfect Player earns First Hit, First Critical Hit, Flawless, then Fortress Taken in order (invariant 3)', () => {
    let save = base();
    let t = 0;
    const rng = () => 0.5;
    QUEST_1.encounters.forEach((template, i) => {
      let { save: s, encounter } = beginEncounter(save, template, new Date(T0 + t), `q${i}`);
      save = s;
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, new Date(T0 + t), rng);
        t += 1000;
        ({ save, encounter } = cast(save, encounter, template, p, p.answer, 1000, new Date(T0 + t), rng));
      }
    });
    const order = ['first-hit', 'first-critical', 'flawless-encounter', 'first-quest'].map((id) => byId(save, id).earnedAt);
    expect(order.every((d) => d !== null)).toBe(true);
    expect([...order].sort()).toEqual(order);
    expect(byId(save, 'first-hit').earnedAt).toBe(byId(save, 'first-critical').earnedAt);
  });

  it('Survival fights count for combat Achievements', () => {
    let { save, encounter } = beginEncounter(base(), survivalRoster(QUEST_1)[0]!, new Date(T0), 's1');
    const p = nextProblem(save, encounter, new Date(T0), () => 0.5);
    ({ save } = cast(save, encounter, survivalRoster(QUEST_1)[0]!, p, p.answer, 1000, new Date(T0), () => 0.5));
    expect(earnedIds(save)).toEqual(['first-hit', 'first-critical']);
  });
});

describe('newlyEarned', () => {
  it('lists exactly the ids that moved from null to a date (invariant 6)', () => {
    const before = { ...base(), attempts: [attempt(0, { outcome: Outcome.Hit, durationMs: 5000 })] };
    const after = { ...before, attempts: [...before.attempts, attempt(1)] };
    expect(newlyEarned(before, after).map((a) => a.id)).toEqual(['first-critical']);
    expect(newlyEarned(after, after)).toEqual([]);
  });
});
