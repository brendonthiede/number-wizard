import type { Problem, TimesTableFact } from './types';

export const factId = (a: number, b: number) => `tt:${Math.min(a, b)}x${Math.max(a, b)}`;

/** The two operands of a times-table Fact id, or null for any other id. */
export function parseFactId(id: string): [number, number] | null {
  const m = /^tt:(\d+)x(\d+)$/.exec(id);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function timesTableFacts(): TimesTableFact[] {
  const facts: TimesTableFact[] = [];
  for (let a = 0; a <= 12; a++) {
    for (let b = a; b <= 12; b++) facts.push({ id: factId(a, b), skill: 'times-table', a, b });
  }
  return facts;
}

export function timesTableProblem(fact: TimesTableFact, rng: () => number = Math.random): Problem {
  const [x, y] = rng() < 0.5 ? [fact.a, fact.b] : [fact.b, fact.a];
  return { factId: fact.id, skill: 'times-table', prompt: `${x} × ${y}`, answer: x * y };
}
