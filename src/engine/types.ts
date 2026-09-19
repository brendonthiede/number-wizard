export const Skill = {
  TimesTable: 'times-table', MultiDigit: 'multi-digit-multiplication', Powers: 'powers', LongDivision: 'long-division',
} as const;
export type SkillId = (typeof Skill)[keyof typeof Skill];
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

/** One Work cell of a Problem: the small Problem shown as its Work label, and the value it expects. */
export interface WorkCell {
  label: string;
  value: number;
}

export interface Problem {
  factId: FactId;
  skill: SkillId;
  prompt: string;
  answer: number;
  operands?: [number, number]; // multi-digit only
  work?: WorkCell[]; // multi-digit only; absent means the Problem has no Work
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
  // Present only on a Work grid Attempt. The factId is the Tier, so these are the only record of the Problem.
  operands?: [number, number];
  work?: (number | null)[]; // as entered, in cell order
  labelsShown?: boolean; // the Work labels were visible at any moment of this Problem
}

export const MasteryState = { Learning: 'learning', Mastered: 'mastered' } as const;
export type MasteryState = (typeof MasteryState)[keyof typeof MasteryState];

export interface FactStatus {
  state: MasteryState;
  streak: number; // consecutive fast, correct Attempts
  dueAt: string | null; // ISO; only when mastered
}
