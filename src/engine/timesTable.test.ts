import { describe, expect, it } from 'vitest';
import { factId, timesTableFacts, timesTableProblem } from './timesTable';

describe('times-table Facts', () => {
  it('has 91 commutative Facts for 0 to 12', () => {
    const facts = timesTableFacts();
    expect(facts).toHaveLength(91);
    expect(new Set(facts.map((f) => f.id)).size).toBe(91);
    expect(facts.every((f) => f.a <= f.b)).toBe(true);
  });

  it('gives 3×4 and 4×3 the same id', () => {
    expect(factId(4, 3)).toBe(factId(3, 4));
    expect(factId(3, 4)).toBe('tt:3x4');
  });

  it('builds a Problem with the right answer in either operand order', () => {
    const fact = { id: factId(3, 4), skill: 'times-table' as const, a: 3, b: 4 };
    expect(timesTableProblem(fact, () => 0)).toEqual({
      factId: 'tt:3x4', skill: 'times-table', prompt: '3 × 4', answer: 12,
    });
    expect(timesTableProblem(fact, () => 0.9).prompt).toBe('4 × 3');
  });
});
