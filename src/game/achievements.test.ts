import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_COUNT, achievements, newlyEarned } from './achievements';
import { PLAN_KIND } from './learningPlan';
import { beginEncounter, cast, nextProblem } from './play';
import { survivalRoster } from './survival';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { EncounterStatus } from '../engine/combat';
import { statusByFact, TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { masteryStreakFor } from '../engine/rows';
import { factId, timesTableFacts } from '../engine/timesTable';
import { MasteryState, Outcome, type Attempt } from '../engine/types';
import { emptySave, withCharacter, withLearningPlan, type EncounterRecord, type SaveData } from '../storage/save';

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
  it('lists exactly twenty-five in table order with nothing earned for a new Player (invariant 1)', () => {
    const list = achievements(base());
    expect(list).toHaveLength(ACHIEVEMENT_COUNT);
    // The id list below is the source of truth for the count, not the design doc's "20" (see task-1-report.md).
    expect(ACHIEVEMENT_COUNT).toBe(25);
    expect(list.map((a) => a.id)).toEqual([
      'first-hit', 'first-critical', 'five-criticals', 'flawless-encounter',
      ...Array.from({ length: 13 }, (_, n) => `row-${n}`), 'skill-times-table', 'first-quest',
      'tier-md-2x1', 'tier-md-3x1', 'tier-md-2x2', 'skill-multi-digit', 'second-quest', 'no-labels',
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

  it('90 table Facts Mastered plus three fast non-table Attempts never earns Times Table Master', () => {
    let i = 0;
    const all: Attempt[] = [];
    for (const f of timesTableFacts().slice(0, -1)) {
      const n = f.a <= 1 || f.b <= 1 ? 1 : 3;
      for (let k = 0; k < n; k++) all.push(attempt(i++, { factId: f.id }));
    }
    for (let k = 0; k < 3; k++) all.push(attempt(i++, { factId: 'md:12x34' }));
    const save = { ...base(), attempts: all };
    expect(byId(save, 'skill-times-table').earnedAt).toBeNull();
    expect(byId(save, 'first-critical').earnedAt).not.toBeNull();
  });

  it('ignores Fact ids outside the table: out-of-range never throws, non-canonical never counts', () => {
    expect(() => achievements({ ...base(), attempts: [attempt(0, { factId: 'tt:12x34' })] })).not.toThrow();
    let i = 0;
    const all: Attempt[] = [];
    for (const f of timesTableFacts().slice(0, -1)) {
      const n = f.a <= 1 || f.b <= 1 ? 1 : 3;
      for (let k = 0; k < n; k++) all.push(attempt(i++, { factId: f.id }));
    }
    for (let k = 0; k < 3; k++) all.push(attempt(i++, { factId: 'tt:4x3' })); // canonical id is tt:3x4
    expect(byId({ ...base(), attempts: all }, 'skill-times-table').earnedAt).toBeNull();
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

  it('a stricter plan never un-earns an Achievement; a looser one helps (invariant 4)', () => {
    const rowZero = Array.from({ length: 11 }, (_, i) => attempt(i, { factId: factId(0, i), durationMs: 3000 }));
    const save = { ...base(), attempts: rowZero };
    const strict = withLearningPlan(save, { kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 2000 } }, new Date(T0));
    expect(earnedIds(strict)).toEqual(earnedIds(save));
    expect(byId(strict, 'row-0').earnedAt).not.toBeNull();
    const slow = { ...base(), attempts: rowZero.map((a) => ({ ...a, durationMs: 5000 })) };
    expect(byId(slow, 'row-0').earnedAt).toBeNull();
    const loose = withLearningPlan(slow, { kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 6000 } }, new Date(T0));
    expect(byId(loose, 'row-0').earnedAt).not.toBeNull();
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

describe('Quest 2 Achievements', () => {
  const t = (i: number) => new Date(Date.UTC(2026, 8, 18, 12, 0, i)).toISOString();
  const grid = (factId: string, i: number, extra: Partial<Attempt> = {}): Attempt => ({
    factId, answer: 1, correct: true, durationMs: 5000, at: t(i), encounterId: `e${i}`, outcome: 'critical',
    operands: [12, 3], work: [6, 30], labelsShown: false, ...extra,
  });
  const rec = (i: number, status: 'won' | 'retreated' = 'won', questId = 'golem-foundry', monsterId = 'splitter-critter'): EncounterRecord => ({
    id: `e${i}`, questId, monsterId, monsterMaxHp: 4, startedAt: t(i), endedAt: t(i), status, xp: 1, loot: null,
  });
  const earned = (save: SaveData, id: string) => achievements(save).find((a) => a.id === id)!.earnedAt;
  const withAll = (attempts: Attempt[], encounters: EncounterRecord[] = []): SaveData => ({ ...emptySave('noah'), attempts, encounters });

  it('has 25 Achievements', () => {
    expect(ACHIEVEMENT_COUNT).toBe(25);
    expect(achievements(emptySave('noah')).map((a) => a.id)).toEqual(expect.arrayContaining([
      'tier-md-2x1', 'tier-md-3x1', 'tier-md-2x2', 'skill-multi-digit', 'second-quest', 'no-labels',
    ]));
  });

  it('earns a Tier Achievement at the fifth fast correct Attempt, not the fourth', () => {
    const four = [0, 1, 2, 3].map((i) => grid('md:2x1', i));
    expect(earned(withAll(four), 'tier-md-2x1')).toBeNull();
    expect(earned(withAll([...four, grid('md:2x1', 4)]), 'tier-md-2x1')).toBe(t(4));
  });

  it('a Glancing Blow breaks a Tier streak', () => {
    const attempts = [0, 1, 2, 3].map((i) => grid('md:2x1', i));
    attempts.push(grid('md:2x1', 4, { outcome: 'glancing' }), grid('md:2x1', 5));
    expect(earned(withAll(attempts), 'tier-md-2x1')).toBeNull();
  });

  it('earns Multiplication Master when all three Tiers are Mastered at once', () => {
    const attempts: Attempt[] = [];
    let i = 0;
    for (const id of ['md:2x1', 'md:3x1', 'md:2x2']) for (let n = 0; n < 5; n++) attempts.push(grid(id, i++));
    expect(earned(withAll(attempts.slice(0, 14)), 'skill-multi-digit')).toBeNull();
    expect(earned(withAll(attempts), 'skill-multi-digit')).toBe(t(14));
  });

  it('earns Foundry Cooled when every Quest 2 Encounter is won', () => {
    const records = QUEST_2.encounters.map((e, i) => rec(i, 'won', QUEST_2.id, e.monsterId));
    expect(earned(withAll([], records.slice(0, 6)), 'second-quest')).toBeNull();
    expect(earned(withAll([], records), 'second-quest')).toBe(t(6));
    expect(earned(withAll([], records), 'first-quest')).toBeNull();
  });

  it('No Labels: ten wins in a row with no label shown (invariant 9)', () => {
    const run = (n: number, from = 0) => Array.from({ length: n }, (_, k) => from + k);
    const clean = run(10);
    expect(earned(withAll(clean.map((i) => grid('md:2x1', i)), clean.map((i) => rec(i))), 'no-labels')).toBe(t(9));
    const nine = run(9);
    expect(earned(withAll(nine.map((i) => grid('md:2x1', i)), nine.map((i) => rec(i))), 'no-labels')).toBeNull();
  });

  it('No Labels is reset by a single peek and by a Retreat, and ignores Encounters with no grid (invariant 9)', () => {
    const ids = Array.from({ length: 12 }, (_, k) => k);
    const peeked = ids.map((i) => grid('md:2x1', i, i === 5 ? { labelsShown: true } : {}));
    // Wins 0-4, a peek at 5, then wins 6-11 is only six in a row.
    expect(earned(withAll(peeked, ids.map((i) => rec(i))), 'no-labels')).toBeNull();

    const retreat = ids.map((i) => rec(i, i === 5 ? 'retreated' : 'won'));
    expect(earned(withAll(ids.map((i) => grid('md:2x1', i)), retreat), 'no-labels')).toBeNull();

    // A table-only Encounter in the middle neither counts nor resets.
    const table: Attempt = { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 900, at: t(50), encounterId: 'table', outcome: 'critical' };
    const ten = ids.slice(0, 10);
    const attempts = [...ten.slice(0, 5).map((i) => grid('md:2x1', i)), table, ...ten.slice(5).map((i) => grid('md:2x1', i))];
    const records = [...ten.slice(0, 5).map((i) => rec(i)), { ...rec(50, 'retreated', 'fortress-of-twelves', 'gob-nine'), id: 'table' }, ...ten.slice(5).map((i) => rec(i))];
    expect(earned(withAll(attempts, records), 'no-labels')).toBe(t(9));
  });

  it('treats a grid Attempt with labelsShown missing as shown', () => {
    const ids = Array.from({ length: 10 }, (_, k) => k);
    const attempts = ids.map((i) => { const { labelsShown: _drop, ...a } = grid('md:2x1', i); return a as Attempt; });
    expect(earned(withAll(attempts, ids.map((i) => rec(i))), 'no-labels')).toBeNull();
  });
});
