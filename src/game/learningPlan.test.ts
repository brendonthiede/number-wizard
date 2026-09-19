import { describe, expect, it } from 'vitest';
import {
  achievementThresholdFor, isEmphasized, nextExplicitProblem, parseLearningPlan, PLAN_KIND,
  remainingExplicit, scaledHp, tableThresholdFor, thresholdFor,
} from './learningPlan';
import { emptySave, withAttempt, withCharacter, withLearningPlan } from '../storage/save';
import { Outcome, type Attempt } from '../engine/types';

const example = {
  kind: PLAN_KIND, version: 1, unlockedSkills: ['times-table'], emphasize: ['tt:7x8', 'tt:6x9'],
  thresholds: { 'times-table': 5000 }, monsterHpScale: 1, problems: [[7, 8], [6, 9]], note: 'free text the game ignores',
};

describe('parseLearningPlan', () => {
  it('accepts the spec example and a minimal plan (invariant 1)', () => {
    expect(parseLearningPlan(example)).toEqual(example);
    expect(parseLearningPlan({ kind: PLAN_KIND, version: 1 })).toEqual({ kind: PLAN_KIND, version: 1 });
    expect(PLAN_KIND).toBe('number-wizard-learning-plan');
  });

  it('rejects each single violation with a message naming the field (invariant 1)', () => {
    const bad: [object, string][] = [
      [{ ...example, kind: 'something-else' }, 'kind'],
      [{ ...example, version: 2 }, 'version'],
      [{ ...example, emphasize: ['tt:4x3'] }, 'emphasize'],
      [{ ...example, emphasize: 'tt:3x4' }, 'emphasize'],
      [{ ...example, thresholds: { 'times-table': 999 } }, 'thresholds'],
      [{ ...example, thresholds: { 'times-table': 60001 } }, 'thresholds'],
      [{ ...example, thresholds: { 'times-table': NaN } }, 'thresholds'],
      [{ ...example, thresholds: { powers: 5000 } }, 'thresholds'],
      [{ ...example, monsterHpScale: 0.49 }, 'monsterHpScale'],
      [{ ...example, monsterHpScale: 3.01 }, 'monsterHpScale'],
      [{ ...example, problems: [[7, 13]] }, 'problems'],
      [{ ...example, problems: [[7.5, 8]] }, 'problems'],
      [{ ...example, problems: [[7]] }, 'problems'],
      [{ ...example, problems: Array.from({ length: 51 }, () => [1, 1]) }, 'problems'],
      [{ ...example, unlockedSkills: ['algebra'] }, 'unlockedSkills'],
      [{ ...example, note: 'x'.repeat(2001) }, 'note'],
      [{ ...example, surprise: true }, 'surprise'],
    ];
    for (const [raw, field] of bad) expect(() => parseLearningPlan(raw), field).toThrow(field);
    expect(() => parseLearningPlan(null)).toThrow('Learning Plan');
    expect(() => parseLearningPlan('[]')).toThrow('Learning Plan');
  });

  it('returns a copy holding only known fields, never the caller\'s object', () => {
    const parsed = parseLearningPlan(example);
    expect(parsed).not.toBe(example);
  });
});

const T0 = Date.parse('2026-09-18T12:00:00.000Z');
const base = () => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const planned = (plan: object) => withLearningPlan(base(), { kind: PLAN_KIND, version: 1, ...plan } as never, new Date(T0));
const attempt = (factId: string, offsetMs: number): Attempt => ({ factId, answer: 0, correct: true, durationMs: 1500, at: new Date(T0 + offsetMs).toISOString(), encounterId: 'e', outcome: Outcome.Critical });

describe('plan rules', () => {
  it('fall back to the defaults without a plan', () => {
    expect(thresholdFor(base(), 'tt:7x8')).toBe(4000);
    expect(achievementThresholdFor(base(), 'tt:7x8')).toBe(4000);
    expect(scaledHp(base(), 6)).toBe(6);
    expect(isEmphasized(base(), 'tt:7x8')).toBe(false);
    expect(nextExplicitProblem(base(), new Set())).toBeNull();
    expect(remainingExplicit(base())).toBe(0);
  });

  it('threshold follows the plan; Achievements take the more lenient of the two', () => {
    expect(thresholdFor(planned({ thresholds: { 'times-table': 6000 } }), 'tt:7x8')).toBe(6000);
    expect(achievementThresholdFor(planned({ thresholds: { 'times-table': 6000 } }), 'tt:7x8')).toBe(6000);
    expect(thresholdFor(planned({ thresholds: { 'times-table': 2000 } }), 'tt:7x8')).toBe(2000);
    expect(achievementThresholdFor(planned({ thresholds: { 'times-table': 2000 } }), 'tt:7x8')).toBe(4000);
  });

  it('scaledHp rounds and never goes below 1 (invariant 6)', () => {
    expect(scaledHp(planned({ monsterHpScale: 1.5 }), 7)).toBe(11);
    expect(scaledHp(planned({ monsterHpScale: 0.5 }), 1)).toBe(1);
    expect(scaledHp(planned({ monsterHpScale: 3 }), 15)).toBe(45);
  });

  it('serves explicit Problems in order, each once, counting only Attempts after the import (invariant 5)', () => {
    let save = planned({ problems: [[7, 8], [6, 9], [8, 7]] });
    save = withAttempt(save, attempt('tt:7x8', -1000)); // before the import: does not count
    expect(remainingExplicit(save)).toBe(3);
    expect(nextExplicitProblem(save, new Set())).toEqual({ factId: 'tt:7x8', skill: 'times-table', prompt: '7 × 8', answer: 56 });
    expect(nextExplicitProblem(save, new Set(['tt:7x8']))!.prompt).toBe('6 × 9'); // blocked by the no-repeat rule, the next one goes
    save = withAttempt(save, attempt('tt:7x8', 1000));
    expect(nextExplicitProblem(save, new Set())!.prompt).toBe('6 × 9');
    save = withAttempt(save, attempt('tt:6x9', 2000));
    expect(nextExplicitProblem(save, new Set())!.prompt).toBe('8 × 7'); // same Fact as 7 × 8, needs a second Attempt
    save = withAttempt(save, attempt('tt:7x8', 3000));
    expect(nextExplicitProblem(save, new Set())).toBeNull();
    expect(remainingExplicit(save)).toBe(0);
  });

  it('marks emphasised Facts', () => {
    expect(isEmphasized(planned({ emphasize: ['tt:7x8'] }), 'tt:7x8')).toBe(true);
    expect(isEmphasized(planned({ emphasize: ['tt:7x8'] }), 'tt:6x9')).toBe(false);
  });
});

describe('thresholds per Fact', () => {
  const base2 = { kind: PLAN_KIND, version: 1 };
  const withPlan = (extra: object) => withLearningPlan(emptySave('noah'), parseLearningPlan({ ...base2, ...extra }), new Date('2026-09-18T12:00:00Z'));

  it('defaults to 4000 ms for a table Fact and to the Tier threshold for a Tier', () => {
    const save = emptySave('noah');
    expect(thresholdFor(save, 'tt:7x8')).toBe(4000);
    expect(tableThresholdFor(save)).toBe(4000);
    expect(thresholdFor(save, 'md:2x1')).toBe(20000);
    expect(thresholdFor(save, 'md:3x1')).toBe(30000);
    expect(thresholdFor(save, 'md:2x2')).toBe(45000);
  });

  it('lets a plan set each Tier and the table apart', () => {
    const save = withPlan({ thresholds: { 'times-table': 6000, 'md:2x2': 60000 } });
    expect(thresholdFor(save, 'tt:7x8')).toBe(6000);
    expect(thresholdFor(save, 'md:2x2')).toBe(60000);
    expect(thresholdFor(save, 'md:2x1')).toBe(20000);
  });

  it('rejects a Tier threshold outside 5000 to 180000 ms and an unknown key', () => {
    expect(() => parseLearningPlan({ ...base2, thresholds: { 'md:2x1': 4999 } })).toThrow('Learning Plan: thresholds md:2x1 must be 5000 to 180000 ms');
    expect(() => parseLearningPlan({ ...base2, thresholds: { 'md:2x1': 180001 } })).toThrow('Learning Plan: thresholds');
    expect(() => parseLearningPlan({ ...base2, thresholds: { 'md:9x9': 20000 } })).toThrow('Learning Plan: thresholds may only set');
  });

  it('gives Achievements the more lenient of the default and the plan, per Fact', () => {
    const strict = withPlan({ thresholds: { 'md:2x1': 10000 } });
    const loose = withPlan({ thresholds: { 'md:2x1': 40000 } });
    expect(achievementThresholdFor(strict, 'md:2x1')).toBe(20000);
    expect(achievementThresholdFor(loose, 'md:2x1')).toBe(40000);
    expect(achievementThresholdFor(loose, 'tt:7x8')).toBe(4000);
  });
});
