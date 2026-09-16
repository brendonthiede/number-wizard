import type { FactId, Outcome } from './types';

export interface SpellInput {
  factId: FactId;
  answer: number | null;
  correct: boolean;
  workCorrect: boolean;
  durationMs: number;
}

export function resolveSpell(input: SpellInput, thresholdMs: number): Outcome {
  if (!input.correct) return 'miss';
  if (!input.workCorrect) return 'glancing';
  return input.durationMs < thresholdMs ? 'critical' : 'hit';
}

const DAMAGE: Record<Outcome, number> = { critical: 2, hit: 1, glancing: 1, miss: 0 };
export const damageOf = (outcome: Outcome): number => DAMAGE[outcome];
