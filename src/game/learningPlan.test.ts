import { describe, expect, it } from 'vitest';
import { parseLearningPlan, PLAN_KIND } from './learningPlan';

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
