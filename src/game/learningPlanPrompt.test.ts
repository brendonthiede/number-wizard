import { describe, expect, it } from 'vitest';
import prompt from '../../docs/guide/learning-plan-prompt.md?raw';
import { LIMITS, parseLearningPlan, PLAN_KIND } from './learningPlan';

/** The template must state the parser's own limits, so neither can drift from the other. */
describe('the Learning Plan prompt', () => {
  it('names every limit the parser enforces, with the parser\'s values', () => {
    const expected = [
      `${LIMITS.thresholdMin} to ${LIMITS.thresholdMax}`,
      `${LIMITS.tierThresholdMin} to ${LIMITS.tierThresholdMax}`,
      `${LIMITS.scaleMin} to ${LIMITS.scaleMax}`,
      `at most ${LIMITS.problems}`,
      `0 to ${LIMITS.operandMax}`,
      `${LIMITS.note} characters`,
      `"${PLAN_KIND}"`,
      'md:2x1', 'md:3x1', 'md:2x2',
      'multi-digit-multiplication',
    ];
    for (const text of expected) expect(prompt, text).toContain(text);
  });

  it('gives an example plan that the game accepts as written', () => {
    const blocks = [...prompt.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(() => parseLearningPlan(JSON.parse(block))).not.toThrow();
  });

  it('asks for the summary first, then the plan in one block, and never story', () => {
    expect(prompt).toMatch(/summary/i);
    expect(prompt).toMatch(/one code block|a single code block/i);
    expect(prompt).toMatch(/never.*story|no story/i);
  });
});
