import { MasteryState, Skill, type Fact, type FactId, type FactStatus, type Problem } from './types';

export const TierId = { TwoByOne: 'md:2x1', ThreeByOne: 'md:3x1', TwoByTwo: 'md:2x2' } as const;
export type TierId = (typeof TierId)[keyof typeof TierId];

/** A size class of multi-digit Problem. A Tier is a Fact: it is mastered and reviewed like one. */
export interface Tier extends Fact {
  id: TierId;
  skill: typeof Skill.MultiDigit;
  name: string;
  digits: [number, number];
  thresholdMs: number;
}

// In opening order. The threshold covers typing every Work cell plus the answer.
export const TIERS: Tier[] = [
  { id: TierId.TwoByOne, skill: Skill.MultiDigit, name: '2×1', digits: [2, 1], thresholdMs: 20_000 },
  { id: TierId.ThreeByOne, skill: Skill.MultiDigit, name: '3×1', digits: [3, 1], thresholdMs: 30_000 },
  { id: TierId.TwoByTwo, skill: Skill.MultiDigit, name: '2×2', digits: [2, 2], thresholdMs: 45_000 },
];

// A Tier covers thousands of Problems, so it needs more proof than a single table Fact's three.
export const TIER_MASTERY_STREAK = 5;

/** The Tier with this id, or undefined for any other Fact id. */
export const tierById = (id: FactId): Tier | undefined => TIERS.find((t) => t.id === id);

/** Whether a Fact id names a Tier. */
export const isTierId = (id: FactId): id is TierId => tierById(id) !== undefined;

/** The Tiers the Player may be served: the first, any whose predecessor is Mastered, and any already met. */
export function openTiers(status: Record<FactId, FactStatus>): Tier[] {
  return TIERS.filter((t, i) =>
    i === 0 || status[t.id] !== undefined || status[TIERS[i - 1]!.id]?.state === MasteryState.Mastered);
}

const digit = (min: number, rng: () => number): number => Math.min(9, min + Math.floor(rng() * (10 - min)));

function operand(count: number, min: number, rng: () => number): number {
  let n = 0;
  for (let i = 0; i < count; i++) n = n * 10 + digit(min, rng);
  return n;
}

// 47 becomes [7, 40]: ones first, matching the order the Work cells run in.
const places = (n: number): number[] => String(n).split('').reverse().map((d, i) => Number(d) * 10 ** i);

/**
 * A Problem for a Tier with its partial-product Work cells. No operand has a zero digit and the
 * second operand has no 1, so every cell is a real table Fact times a power of ten.
 */
export function multiDigitProblem(tier: Tier, rng: () => number = Math.random): Problem {
  const a = operand(tier.digits[0], 1, rng);
  const b = operand(tier.digits[1], 2, rng);
  const work = places(b).flatMap((pb) => places(a).map((pa) => ({ label: `${pb} × ${pa}`, value: pb * pa })));
  return { factId: tier.id, skill: tier.skill, prompt: `${a} × ${b}`, answer: a * b, operands: [a, b], work };
}

/** Marks each entered cell right or wrong. Order never matters: the expected values are a multiset, each used once. */
export function checkWork(expected: number[], entered: (number | null)[]): boolean[] {
  const left = [...expected];
  return entered.map((v) => {
    const i = v === null ? -1 : left.indexOf(v);
    if (i === -1) return false;
    left.splice(i, 1);
    return true;
  });
}

/** True when the Problem has no Work, or every Work cell was entered right. */
export const isWorkCorrect = (problem: Problem, entered: (number | null)[]): boolean =>
  !problem.work || (entered.length === problem.work.length && checkWork(problem.work.map((c) => c.value), entered).every(Boolean));
