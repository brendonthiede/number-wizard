export type SkillId = 'times-table' | 'multi-digit-multiplication' | 'powers' | 'long-division';
export type FactId = string;

export interface Fact {
  id: FactId;
  skill: SkillId;
}

export interface TimesTableFact extends Fact {
  skill: 'times-table';
  a: number; // a <= b, canonical order
  b: number;
}

export interface Problem {
  factId: FactId;
  skill: SkillId;
  prompt: string;
  answer: number;
}

// The record of what the Player saw at cast time; never recomputed. Mastery reads only
// `correct`, `durationMs`, and whether this was a Glancing Blow (Work wrong, threshold-free),
// so a later threshold change never rewrites history.
export const Outcome = { Critical: 'critical', Hit: 'hit', Glancing: 'glancing', Miss: 'miss' } as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export interface Attempt {
  factId: FactId;
  answer: number | null;
  correct: boolean;
  durationMs: number;
  at: string; // ISO timestamp
  encounterId: string;
  outcome: Outcome;
}

export const MasteryState = { Learning: 'learning', Mastered: 'mastered' } as const;
export type MasteryState = (typeof MasteryState)[keyof typeof MasteryState];

export interface FactStatus {
  state: MasteryState;
  streak: number; // consecutive fast, correct Attempts
  dueAt: string | null; // ISO; only when mastered
}
