# Quest 2 and the Work Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the multi-digit multiplication Skill with three Tiers, the Work grid that collects partial products, and Quest 2, The Golem Foundry.

**Architecture:** A new pure engine module owns Tiers, Problem generation and Work checking. The save gains three optional Attempt fields and one stored setting (version 6). `play.ts` picks a Tier or a table Review Problem from the Encounter's Skill. A controlled `WorkGrid` component plugs into `EncounterScreen`. Achievements stay derived.

**Tech Stack:** Vite 8, React 19, TypeScript 7 strict with `noUncheckedIndexedAccess`, Vitest 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-18-quest-2-work-grid-design.md`. Read it before any task. Its ten invariants are the acceptance tests.

## Global Constraints

- TDD is mandatory: write the failing test, run it and see it fail, then write the code.
- No magic strings in production code. State-like unions are `as const` objects with a derived type, compared as `Outcome.Glancing`, `Skill.MultiDigit`, `TierId.TwoByOne`. Tests may use literals.
- Use the `CONTEXT.md` vocabulary: Player, Guide, Skill, Tier, Fact, Problem, Work, Work grid, Work label, Attempt, Mastered, Learning, Due, Quest, Encounter, Spell, Hit, Glancing Blow, Critical Hit, Miss, Retreat, Loot, Achievement.
- Comments state the constraint in one or two sentences. Never narrate how you found something.
- Docstrings: before every commit run `npm run docstrings`. It lists every top-level function without a `/** */` docstring in any file the branch changed. Add a one or two sentence docstring to each one listed, including old functions in files you touched.
- Never add a `Co-Authored-By`, a "Generated with" line, or any Claude or Anthropic attribution to a commit.
- Never push. Commit only.
- Component tests start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`.
- The save blob is the only copy of the Player's history (ADR-0001). An old save must always load.
- Before each commit run `npm test` and `npm run typecheck`. Both must pass.
- Exact values from the spec: thresholds 20000, 30000, 45000 ms; Tier mastery streak 5; Review share one in five; a Work cell holds at most six digits; Monster HP 4, 4, 5, 5, 6, 7, 8; "No Labels" at ten wins.

## File map

| File | Responsibility |
|---|---|
| `src/engine/types.ts` | `Skill` const, `WorkCell`, optional fields on `Problem` and `Attempt` |
| `src/engine/multiDigit.ts` (new) | Tiers, `openTiers`, `multiDigitProblem`, `checkWork`, `isWorkCorrect` |
| `src/engine/rows.ts` | `masteryStreakFor` returns 5 for a Tier |
| `src/engine/mastery.ts` | `statusByFact` accepts a per-Fact threshold |
| `src/engine/combat.ts` | `castSpell` records the grid fields on the Attempt |
| `src/game/learningPlan.ts` | per-Fact `thresholdFor`, Tier thresholds in a plan |
| `src/storage/save.ts` | version 6, `settings`, validation of the new Attempt fields |
| `src/content/quest2.ts` (new) | The Golem Foundry and its Loot |
| `src/content/quest1.ts` | `Quest.skill`, `Quest.requires`, `QUESTS`, merged `LOOT` |
| `src/game/quest.ts` | `questOpen`, `openQuests` |
| `src/game/play.ts` | Tier selection, Review mix, Work-aware `cast`, `shouldNudgeLabels` |
| `src/ui/WorkGrid.tsx` (new) | the controlled Work grid |
| `src/ui/Keypad.tsx` | Next key, digit cap, cast override |
| `src/ui/EncounterScreen.tsx` | grid state, labels, feedback that waits |
| `src/game/achievements.ts` | six new Achievements |
| `src/ui/QuestListScreen.tsx` (new), `src/App.tsx`, `src/ui/ResultScreen.tsx` | Quest list, per-Quest routing, the nudge |

---

### Task 1: Tiers, Problems and Work checking

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/multiDigit.ts`, `src/engine/multiDigit.test.ts`
- Modify: `src/engine/rows.ts`, `src/engine/rows.test.ts`

**Interfaces:**
- Consumes: `Fact`, `FactId`, `FactStatus`, `MasteryState`, `Problem` from `src/engine/types.ts`.
- Produces:
  - `Skill` const and `SkillId` derived from it (same four string values as today).
  - `WorkCell { label: string; value: number }`; `Problem.operands?: [number, number]`; `Problem.work?: WorkCell[]`.
  - `Attempt.operands?: [number, number]`; `Attempt.work?: (number | null)[]`; `Attempt.labelsShown?: boolean`.
  - `TierId`, `Tier`, `TIERS`, `TIER_MASTERY_STREAK`, `isTierId(id): id is TierId`, `tierById(id): Tier | undefined`, `openTiers(status): Tier[]`, `multiDigitProblem(tier, rng?): Problem`, `checkWork(expected, entered): boolean[]`, `isWorkCorrect(problem, entered): boolean`.
  - `masteryStreakFor(id)` returns 5 for a Tier id.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/multiDigit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { factStatus } from './mastery';
import { checkWork, isTierId, isWorkCorrect, multiDigitProblem, openTiers, TIERS, TIER_MASTERY_STREAK, TierId } from './multiDigit';
import { masteryStreakFor } from './rows';
import { MasteryState, type Attempt, type FactStatus } from './types';

const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const mastered: FactStatus = { state: MasteryState.Mastered, streak: 5, dueAt: '2030-01-01T00:00:00.000Z' };
const learning: FactStatus = { state: MasteryState.Learning, streak: 0, dueAt: null };

describe('Tiers', () => {
  it('lists three Tiers in opening order with the spec thresholds', () => {
    expect(TIERS.map((t) => [t.id, t.digits, t.thresholdMs])).toEqual([
      ['md:2x1', [2, 1], 20000], ['md:3x1', [3, 1], 30000], ['md:2x2', [2, 2], 45000],
    ]);
    expect(TIERS.every((t) => t.skill === 'multi-digit-multiplication')).toBe(true);
    expect(isTierId('md:2x2')).toBe(true);
    expect(isTierId('tt:2x2')).toBe(false);
  });

  it('opens the first Tier always, the next when the one before is Mastered, and never takes a met Tier away', () => {
    expect(openTiers({}).map((t) => t.id)).toEqual(['md:2x1']);
    expect(openTiers({ 'md:2x1': learning }).map((t) => t.id)).toEqual(['md:2x1']);
    expect(openTiers({ 'md:2x1': mastered }).map((t) => t.id)).toEqual(['md:2x1', 'md:3x1']);
    expect(openTiers({ 'md:2x1': learning, 'md:3x1': learning }).map((t) => t.id)).toEqual(['md:2x1', 'md:3x1']);
    expect(openTiers({ 'md:2x1': mastered, 'md:3x1': mastered }).map((t) => t.id)).toEqual(['md:2x1', 'md:3x1', 'md:2x2']);
  });
});

describe('multiDigitProblem', () => {
  it('builds operands with no zero digit, the second from 2 to 9, and Work that sums to the answer', () => {
    const rng = seeded(7);
    for (const tier of TIERS) {
      for (let i = 0; i < 300; i++) {
        const p = multiDigitProblem(tier, rng);
        const [a, b] = p.operands!;
        expect(String(a)).toHaveLength(tier.digits[0]);
        expect(String(b)).toHaveLength(tier.digits[1]);
        expect(String(a)).not.toContain('0');
        expect(String(b)).toMatch(/^[2-9]+$/);
        expect(p.factId).toBe(tier.id);
        expect(p.skill).toBe('multi-digit-multiplication');
        expect(p.prompt).toBe(`${a} × ${b}`);
        expect(p.answer).toBe(a * b);
        expect(p.work).toHaveLength(tier.digits[0] * tier.digits[1]);
        expect(p.work!.reduce((sum, c) => sum + c.value, 0)).toBe(a * b);
      }
    }
  });

  it('never breaks when the rng returns its extremes', () => {
    for (const r of [0, 0.999999]) {
      const p = multiDigitProblem(TIERS[2]!, () => r);
      expect(p.operands![0]).toBeGreaterThanOrEqual(11);
      expect(p.operands![0]).toBeLessThanOrEqual(99);
    }
  });

  it('labels cells ones digit of the second operand first', () => {
    // 47 × 36: digits come from the rng in order 4, 7, 3, 6.
    const digits = [4, 7, 3, 6];
    let i = 0;
    const first = (d: number) => (d - 1) / 9 + 0.001; // digit 1 to 9
    const second = (d: number) => (d - 2) / 8 + 0.001; // digit 2 to 9
    const rng = () => { const d = digits[i]!; const r = i < 2 ? first(d) : second(d); i++; return r; };
    const p = multiDigitProblem(TIERS[2]!, rng);
    expect(p.operands).toEqual([47, 36]);
    expect(p.work).toEqual([
      { label: '6 × 7', value: 42 }, { label: '6 × 40', value: 240 },
      { label: '30 × 7', value: 210 }, { label: '30 × 40', value: 1200 },
    ]);
  });
});

describe('checkWork (invariant 1)', () => {
  it('accepts the right partial products in any order', () => {
    expect(checkWork([42, 240], [42, 240])).toEqual([true, true]);
    expect(checkWork([42, 240], [240, 42])).toEqual([true, true]);
    expect(checkWork([42, 240, 210, 1200], [1200, 42, 210, 240])).toEqual([true, true, true, true]);
  });

  it('marks a wrong, empty or repeated value wrong', () => {
    expect(checkWork([42, 240], [42, 241])).toEqual([true, false]);
    expect(checkWork([42, 240], [null, 240])).toEqual([false, true]);
    expect(checkWork([42, 240], [42, 42])).toEqual([true, false]);
  });

  it('needs a duplicate partial product twice (33 × 33 has 90 twice)', () => {
    expect(checkWork([9, 90, 90, 900], [90, 9, 900, 90])).toEqual([true, true, true, true]);
    expect(checkWork([9, 90, 90, 900], [90, 9, 900, null])).toEqual([true, true, true, false]);
  });

  it('isWorkCorrect is true for a Problem with no Work and false for a short entry', () => {
    const table = { factId: 'tt:3x4', skill: 'times-table' as const, prompt: '3 × 4', answer: 12 };
    expect(isWorkCorrect(table, [])).toBe(true);
    const p = multiDigitProblem(TIERS[0]!, seeded(3));
    const values = p.work!.map((c) => c.value);
    expect(isWorkCorrect(p, [...values].reverse())).toBe(true);
    expect(isWorkCorrect(p, values.slice(1))).toBe(false);
    expect(isWorkCorrect(p, [])).toBe(false);
  });
});

describe('Tier Mastery (invariant 3)', () => {
  const at = (i: number) => new Date(Date.UTC(2026, 8, 18, 12, i)).toISOString();
  const fast = (i: number): Attempt => ({ factId: TierId.TwoByOne, answer: 1, correct: true, durationMs: 5000, at: at(i), encounterId: 'e', outcome: 'critical' });

  it('needs five fast correct Attempts in a row; a table Fact still needs three', () => {
    expect(TIER_MASTERY_STREAK).toBe(5);
    expect(masteryStreakFor('md:2x1')).toBe(5);
    expect(masteryStreakFor('tt:7x8')).toBe(3);
    expect(masteryStreakFor('tt:0x8')).toBe(1);
    const four = [0, 1, 2, 3].map(fast);
    expect(factStatus(four, 20000, masteryStreakFor('md:2x1')).state).toBe('learning');
    expect(factStatus([...four, fast(4)], 20000, masteryStreakFor('md:2x1')).state).toBe('mastered');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/multiDigit.test.ts`
Expected: FAIL, cannot resolve `./multiDigit`.

- [ ] **Step 3: Extend the types**

In `src/engine/types.ts` replace the `SkillId` line with:

```ts
export const Skill = {
  TimesTable: 'times-table', MultiDigit: 'multi-digit-multiplication', Powers: 'powers', LongDivision: 'long-division',
} as const;
export type SkillId = (typeof Skill)[keyof typeof Skill];
```

Add after `TimesTableFact`:

```ts
/** One Work cell of a Problem: the small Problem shown as its Work label, and the value it expects. */
export interface WorkCell {
  label: string;
  value: number;
}
```

Add to `Problem`:

```ts
  operands?: [number, number]; // multi-digit only
  work?: WorkCell[]; // multi-digit only; absent means the Problem has no Work
```

Add to `Attempt`:

```ts
  // Present only on a Work grid Attempt. The factId is the Tier, so these are the only record of the Problem.
  operands?: [number, number];
  work?: (number | null)[]; // as entered, in cell order
  labelsShown?: boolean; // the Work labels were visible at any moment of this Problem
```

- [ ] **Step 4: Write the engine module**

Create `src/engine/multiDigit.ts`:

```ts
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
```

- [ ] **Step 5: Make a Tier need five**

In `src/engine/rows.ts` add `import { isTierId, TIER_MASTERY_STREAK } from './multiDigit';` and change `masteryStreakFor`:

```ts
/** How many fast correct Attempts in a row master this Fact: 5 for a Tier, 1 in a warm-up row, 3 elsewhere. */
export function masteryStreakFor(id: FactId): number {
  if (isTierId(id)) return TIER_MASTERY_STREAK;
  const operands = parseFactId(id);
  return operands && operands.some((n) => WARM_UP_ROWS.includes(n)) ? WARM_UP_STREAK : FULL_STREAK;
}
```

- [ ] **Step 6: Run everything**

Run: `npx vitest run src/engine && npm run typecheck && npm test && npm run docstrings`
Expected: all pass. Add a docstring to every function `npm run docstrings` lists.

- [ ] **Step 7: Commit**

```bash
git add src/engine
git commit -m "feat: multi-digit Tiers, partial-product Problems and any-order Work checking"
```

---

### Task 2: A speed threshold per Fact

**Files:**
- Modify: `src/engine/mastery.ts`, `src/engine/mastery.test.ts`
- Modify: `src/game/learningPlan.ts`, `src/game/learningPlan.test.ts`
- Modify: `src/game/play.ts`, `src/game/achievements.ts`, `src/ui/GuideScreen.tsx`, `src/ui/GuideScreen.test.tsx`

**Interfaces:**
- Consumes: `TIERS`, `tierById`, `isTierId`, `TierId` from `src/engine/multiDigit.ts` (Task 1).
- Produces:
  - `statusByFact(attempts, threshold: number | ((id: FactId) => number), streakFor?)`.
  - `thresholdFor(save: SaveData, id: FactId): number`.
  - `tableThresholdFor(save: SaveData): number`.
  - `achievementThresholdFor(save: SaveData, id: FactId): number`.
  - `LearningPlan.thresholds?: Partial<Record<'times-table' | TierId, number>>`.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/mastery.test.ts` inside the `statusByFact` describe (create one if the file has none, importing `statusByFact`):

```ts
  it('takes the threshold per Fact when given a function', () => {
    const a = (factId: string, durationMs: number, i: number): Attempt => ({
      factId, answer: 1, correct: true, durationMs, at: new Date(Date.UTC(2026, 8, 18, 12, i)).toISOString(), encounterId: 'e', outcome: 'hit',
    });
    const attempts = [a('tt:7x8', 9000, 0), a('md:2x1', 9000, 1)];
    const status = statusByFact(attempts, (id) => (id === 'md:2x1' ? 20000 : 4000));
    expect(status['tt:7x8']!.streak).toBe(0);
    expect(status['md:2x1']!.streak).toBe(1);
  });
```

Add to `src/game/learningPlan.test.ts` (it already has a `plan(...)` or save-building helper; reuse the file's own helper for a save with a plan, named `withPlan` below, or build one with `withLearningPlan(emptySave('noah'), parseLearningPlan({...}), NOW)`):

```ts
describe('thresholds per Fact', () => {
  const base = { kind: PLAN_KIND, version: 1 };
  const withPlan = (extra: object) => withLearningPlan(emptySave('noah'), parseLearningPlan({ ...base, ...extra }), new Date('2026-09-18T12:00:00Z'));

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
    expect(() => parseLearningPlan({ ...base, thresholds: { 'md:2x1': 4999 } })).toThrow('Learning Plan: thresholds md:2x1 must be 5000 to 180000 ms');
    expect(() => parseLearningPlan({ ...base, thresholds: { 'md:2x1': 180001 } })).toThrow('Learning Plan: thresholds');
    expect(() => parseLearningPlan({ ...base, thresholds: { 'md:9x9': 20000 } })).toThrow('Learning Plan: thresholds may only set');
  });

  it('gives Achievements the more lenient of the default and the plan, per Fact', () => {
    const strict = withPlan({ thresholds: { 'md:2x1': 10000 } });
    const loose = withPlan({ thresholds: { 'md:2x1': 40000 } });
    expect(achievementThresholdFor(strict, 'md:2x1')).toBe(20000);
    expect(achievementThresholdFor(loose, 'md:2x1')).toBe(40000);
    expect(achievementThresholdFor(loose, 'tt:7x8')).toBe(4000);
  });
});
```

Import what the block needs at the top of the test file: `achievementThresholdFor, parseLearningPlan, PLAN_KIND, tableThresholdFor, thresholdFor` from `./learningPlan`, and `emptySave, withLearningPlan` from `../storage/save`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/mastery.test.ts src/game/learningPlan.test.ts`
Expected: FAIL. `tableThresholdFor` is not exported, and `thresholdFor` ignores its second argument.

- [ ] **Step 3: `statusByFact` takes a number or a function**

In `src/engine/mastery.ts`:

```ts
/** `attempts` must be oldest first; SaveData.attempts is append-only so this holds. The threshold may differ per Fact. */
export function statusByFact(
  attempts: Attempt[], threshold: number | ((id: FactId) => number), streakFor: (id: FactId) => number = () => MASTERY_STREAK,
): Record<FactId, FactStatus> {
  const thresholdOf = typeof threshold === 'number' ? () => threshold : threshold;
  const grouped: Record<FactId, Attempt[]> = {};
  for (const a of attempts) (grouped[a.factId] ??= []).push(a);
  return Object.fromEntries(Object.entries(grouped).map(([id, list]) => [id, factStatus(list, thresholdOf(id), streakFor(id))]));
}
```

- [ ] **Step 4: Thresholds in the Learning Plan**

In `src/game/learningPlan.ts`:

```ts
import { isTierId, tierById, TIERS, type TierId } from '../engine/multiDigit';
```

Change the `LearningPlan` field to `thresholds?: Partial<Record<typeof SKILL | TierId, number>>;` and move `const SKILL = 'times-table';` above the interface. Extend `LIMITS` with `tierThresholdMin: 5000, tierThresholdMax: 180000`. Replace the `thresholds` block of `parseLearningPlan` with:

```ts
  if (r.thresholds !== undefined) {
    const t = r.thresholds as Record<string, unknown> | null;
    const keys: string[] = [SKILL, ...TIERS.map((tier) => tier.id)];
    if (typeof t !== 'object' || t === null || Array.isArray(t) || Object.keys(t).some((k) => !keys.includes(k))) {
      fail('thresholds', `may only set ${keys.map((k) => `"${k}"`).join(', ')}`);
    }
    plan.thresholds = {};
    for (const [key, ms] of Object.entries(t as Record<string, unknown>)) {
      const [min, max] = key === SKILL ? [LIMITS.thresholdMin, LIMITS.thresholdMax] : [LIMITS.tierThresholdMin, LIMITS.tierThresholdMax];
      if (!inRange(ms, min, max)) fail('thresholds', `${key} must be ${min} to ${max} ms`);
      plan.thresholds[key as typeof SKILL | TierId] = ms as number;
    }
  }
```

Replace `thresholdFor` and `achievementThresholdFor` with:

```ts
const defaultThresholdFor = (id: FactId): number => tierById(id)?.thresholdMs ?? TIMES_TABLE_THRESHOLD_MS;

/** The table speed threshold in force: the plan's, or 4000 ms. */
export const tableThresholdFor = (save: SaveData): number => save.learningPlan?.plan.thresholds?.[SKILL] ?? TIMES_TABLE_THRESHOLD_MS;

/** The speed threshold in force for a Fact: a Tier's own, or the table's. Drives Critical Hits, mastery, and Due dates. */
export const thresholdFor = (save: SaveData, id: FactId): number =>
  isTierId(id) ? save.learningPlan?.plan.thresholds?.[id] ?? defaultThresholdFor(id) : tableThresholdFor(save);

/** Achievements use the more lenient of the default and the plan, so a stricter plan never takes one away. */
export const achievementThresholdFor = (save: SaveData, id: FactId): number => Math.max(defaultThresholdFor(id), thresholdFor(save, id));
```

An existing test may expect the old message `may only set "times-table"`. Update it to expect `Learning Plan: thresholds may only set`.

- [ ] **Step 5: Update the three callers**

`src/game/play.ts`:
- in `nextProblem`: `statusByFact(save.attempts, (id) => thresholdFor(save, id), masteryStreakFor)`
- in `cast`: pass `thresholdFor(save, problem.factId)` to `castSpell`

`src/game/achievements.ts`: delete `const threshold = achievementThresholdFor(save);` and inside the loop use `factStatus(byFact[a.factId]!, achievementThresholdFor(save, a.factId), masteryStreakFor(a.factId))`.

`src/ui/GuideScreen.tsx`: import `tableThresholdFor` and `TIERS` (from `../engine/multiDigit`). Replace the `Threshold {thresholdFor(save)} ms.` sentence with:

```tsx
            <p>Thresholds: times table {tableThresholdFor(save)} ms, {TIERS.map((t) => `${t.name} ${thresholdFor(save, t.id)} ms`).join(', ')}.</p>
            <p>Monster HP scale {stored.plan.monsterHpScale ?? 1} (a 6 HP monster has {scaledHp(save, 6)}).</p>
```

Update any GuideScreen test that matches the old sentence so it matches `Thresholds: times table 5000 ms` (or whatever value that test's plan sets) and `Monster HP scale`.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: speed thresholds per Fact, with Tier thresholds in a Learning Plan"
```

---

### Task 3: Save data version 6 and the recorded Work

**Files:**
- Modify: `src/storage/save.ts`, `src/storage/save.test.ts`
- Modify: `src/engine/combat.ts`, `src/engine/combat.test.ts`
- Modify: `src/game/exportFile.test.ts`
- Modify: any test that writes `version: 5` as the current version (find with `grep -rn "version: 5\|version 5" src`)

**Interfaces:**
- Consumes: the optional `Attempt` fields from Task 1.
- Produces:
  - `SaveData.version: 6`; `SaveData.settings: Settings`; `Settings { hideWorkLabels: boolean }`.
  - `withHiddenWorkLabels(data: SaveData): SaveData`.
  - `SpellInput` gains optional `operands`, `work`, `labelsShown`; `castSpell` copies them onto the Attempt only when `work` is defined.

- [ ] **Step 1: Write the failing tests**

Add to `src/storage/save.test.ts` (it already defines `attempt` and imports `migrate`, `emptySave`, `withAttempt`):

```ts
describe('version 6 (invariant 6)', () => {
  const grid = { ...attempt, factId: 'md:2x1', operands: [47, 6] as [number, number], work: [42, null], labelsShown: true };

  it('creates an empty save at version 6 with the Work labels shown', () => {
    expect(emptySave('noah').version).toBe(6);
    expect(emptySave('noah').settings).toEqual({ hideWorkLabels: false });
  });

  it('loads a version 5 save as version 6 with every Attempt unchanged', () => {
    const { settings: _drop, ...rest } = withAttempt(emptySave('noah'), attempt);
    const v5 = JSON.parse(JSON.stringify({ ...rest, version: 5 }));
    const loaded = migrate(v5);
    expect(loaded.version).toBe(6);
    expect(loaded.settings).toEqual({ hideWorkLabels: false });
    expect(loaded.attempts).toEqual([attempt]);
    expect('work' in loaded.attempts[0]!).toBe(false);
  });

  it('keeps a grid Attempt byte for byte', () => {
    const data = withAttempt(emptySave('noah'), grid);
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('rejects a malformed grid field or setting', () => {
    const bad = (a: object) => () => migrate({ ...emptySave('noah'), attempts: [{ ...grid, ...a }] });
    expect(bad({ operands: [47] })).toThrow('Corrupt save data (version 6)');
    expect(bad({ operands: [47, 6.5] })).toThrow('Corrupt save data (version 6)');
    expect(bad({ work: [42, 'x'] })).toThrow('Corrupt save data (version 6)');
    expect(bad({ labelsShown: 'yes' })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), settings: { hideWorkLabels: 'no' } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), settings: undefined })).toThrow('Corrupt save data (version 6)');
  });

  it('withHiddenWorkLabels sets the setting and nothing else', () => {
    const before = emptySave('noah');
    expect(withHiddenWorkLabels(before)).toEqual({ ...before, settings: { hideWorkLabels: true } });
  });
});
```

Add to `src/engine/combat.test.ts` (it already defines `spec` and `NOW`):

```ts
describe('castSpell records the Work', () => {
  it('copies operands, Work and labelsShown onto a grid Attempt', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), {
      factId: 'md:2x1', answer: 282, correct: true, workCorrect: false, durationMs: 9000,
      operands: [47, 6], work: [42, null], labelsShown: true,
    }, 20000, NOW);
    expect(e.spells[0]).toMatchObject({ outcome: 'glancing', operands: [47, 6], work: [42, null], labelsShown: true });
  });

  it('adds no new key to a table Attempt', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), { factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 900 }, 4000, NOW);
    expect(Object.keys(e.spells[0]!).sort()).toEqual(['answer', 'at', 'correct', 'durationMs', 'encounterId', 'factId', 'outcome']);
  });
});
```

Add to `src/game/exportFile.test.ts` (it imports `buildExport`, `parseImport`, `ImportKind`):

```ts
it('an Export holding a grid Attempt survives Import unchanged (invariant 6)', () => {
  const grid = {
    factId: 'md:2x2', answer: 1692, correct: true, durationMs: 30000, at: '2026-09-18T12:00:00.000Z', encounterId: 'e1',
    outcome: 'hit' as const, operands: [47, 36] as [number, number], work: [42, 240, 210, 1200], labelsShown: false,
  };
  const save = withAttempt(emptySave('noah'), grid);
  const parsed = parseImport(JSON.stringify(buildExport(save, new Date('2026-09-18T13:00:00Z'))));
  expect(parsed.kind).toBe(ImportKind.Export);
  if (parsed.kind === ImportKind.Export) expect(parsed.save).toEqual(save);
});
```

Import `emptySave` and `withAttempt` there if the file does not already.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/storage src/engine/combat.test.ts src/game/exportFile.test.ts`
Expected: FAIL. `emptySave` is version 5 and `withHiddenWorkLabels` does not exist.

- [ ] **Step 3: Record the Work in combat**

In `src/engine/combat.ts` add to `SpellInput`:

```ts
  // Work grid Spells only. `work` present is what marks the Attempt as a grid Attempt.
  operands?: [number, number];
  work?: (number | null)[];
  labelsShown?: boolean;
```

In `castSpell` build the Attempt as:

```ts
  const attempt: Attempt = {
    factId: input.factId, answer: input.answer, correct: input.correct, durationMs: input.durationMs,
    at: now.toISOString(), encounterId: encounter.spec.id, outcome,
    // Table Attempts must keep exactly their old keys: the save is compared and exported as written.
    ...(input.work !== undefined && { operands: input.operands, work: input.work, labelsShown: input.labelsShown }),
  };
```

- [ ] **Step 4: Version 6**

In `src/storage/save.ts`:

```ts
/** Player preferences that cannot be derived from history. */
export interface Settings {
  hideWorkLabels: boolean; // a peek never changes this; only hiding does
}
```

Change `SaveData` to `version: 6` and add `settings: Settings;`. Add:

```ts
interface SaveV5 extends Omit<SaveData, 'version' | 'settings'> {
  version: 5;
}
```

Change `SaveV2`, `SaveV3` and `SaveV4` to also omit `'settings'` in their `Omit<...>` lists.

Extend `isAttempt` with, before the final `Object.values(Outcome)` line:

```ts
    && (a.operands === undefined || (Array.isArray(a.operands) && a.operands.length === 2 && a.operands.every((n) => Number.isInteger(n))))
    && (a.work === undefined || (Array.isArray(a.work) && a.work.every((v) => v === null || Number.isFinite(v))))
    && (a.labelsShown === undefined || typeof a.labelsShown === 'boolean')
```

In `migrate`, turn the `version === 5` branch into the `version === 6` branch, add `&& typeof data.settings?.hideWorkLabels === 'boolean'` to its check, and make the error read `Corrupt save data (version 6)`. Then add a new version 5 step after it:

```ts
  if (version === 5) {
    // Version 6 validates the whole body; this step only adds what version 5 lacked.
    return migrate({ ...(raw as SaveV5), version: 6, settings: { hideWorkLabels: false } });
  }
```

Update the docstring of `migrate` to say "version 1-5". Update `emptySave` to `version: 6` with `settings: { hideWorkLabels: false }`. Add:

```ts
/** Makes hidden Work labels the Player's default. There is no way back but Reset, by design. */
export const withHiddenWorkLabels = (data: SaveData): SaveData => ({ ...data, settings: { ...data.settings, hideWorkLabels: true } });
```

- [ ] **Step 5: Fix the tests that name the current version**

Run: `grep -rn "version: 5\|version 5\|(version 5)" src`
For each hit in a test: where it means "the current version", change it to 6 (for example `toThrow('Corrupt save data (version 5)')` on a blob built from `emptySave` becomes version 6). Where a test deliberately builds an old version 5 blob to test migration, leave it, and make sure it has no `settings` key.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: save data version 6 records Work and the hidden-labels setting"
```

---

### Task 4: Quest 2 content and what opens it

**Files:**
- Create: `src/content/quest2.ts`, `src/content/quest2.test.ts`
- Modify: `src/content/index.ts`, `src/content/quest1.ts`, `src/content/quest1.test.ts`
- Modify: `src/game/quest.ts`, `src/game/quest.test.ts`

**Interfaces:**
- Consumes: `Skill`, `SkillId` from `src/engine/types.ts`.
- Produces:
  - `EncounterTemplate.skill: SkillId`.
  - `Quest.skill: SkillId`; `Quest.requires: string | null` (the id of the Quest that must be complete first).
  - `QUEST_2: Quest` and `LOOT_2: Record<string, string>` from `src/content/quest2.ts`.
  - `QUESTS: Quest[]` exported from `src/content/quest1.ts`; `LOOT` there now holds all sixteen names.
  - `questOpen(save: SaveData, quest: Quest): boolean`; `openQuests(save: SaveData): Quest[]` from `src/game/quest.ts`.

`quest2.ts` must import only **types** from `quest1.ts` (`import type`), because `quest1.ts` imports `quest2.ts` at runtime for the registry.

- [ ] **Step 1: Write the failing tests**

Create `src/content/quest2.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findTemplate, LOOT, QUEST_1, QUESTS, SURVIVAL_QUEST_ID } from './quest1';
import { LOOT_2, QUEST_2 } from './quest2';

const sentences = (text: string) => text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;

describe('Quest 2 content', () => {
  it('is The Golem Foundry: seven multi-digit Encounters with HP 4 to 8, opened by Quest 1', () => {
    expect(QUEST_2.id).toBe('golem-foundry');
    expect(QUEST_2.name).toBe('The Golem Foundry');
    expect(QUEST_2.background).toBe('foundry-01');
    expect(QUEST_2.skill).toBe('multi-digit-multiplication');
    expect(QUEST_2.requires).toBe(QUEST_1.id);
    expect(QUEST_2.encounters.map((e) => e.monsterMaxHp)).toEqual([4, 4, 5, 5, 6, 7, 8]);
    expect(QUEST_2.encounters.map((e) => e.monsterId)).toEqual([
      'splitter-critter', 'tens-hen', 'partial-parrot', 'zero-hero', 'hundred-pede', 'sum-o', 'grand-product',
    ]);
    expect(QUEST_2.encounters[6]!.monsterName).toBe('The Grand Product');
    for (const e of QUEST_2.encounters) {
      expect(e.skill).toBe('multi-digit-multiplication');
      expect(e.questId).toBe(QUEST_2.id);
      expect(e.background).toBe(QUEST_2.background);
      expect(e.lootPool).toEqual(Object.keys(LOOT_2));
    }
  });

  it('keeps every Story Panel to at most two sentences', () => {
    for (const e of QUEST_2.encounters) {
      expect(sentences(e.story.text), e.monsterId).toBeLessThanOrEqual(2);
      expect(e.story.text.trim().length).toBeGreaterThan(0);
    }
    expect(sentences(QUEST_2.closing.text)).toBeLessThanOrEqual(2);
  });

  it('adds eight Loot items that never collide with Quest 1, and leaves Quest 1 its own pool', () => {
    expect(Object.keys(LOOT_2)).toHaveLength(8);
    expect(LOOT_2['ring-of-zeros']).toBe('Ring of Zeros');
    expect(Object.keys(LOOT)).toHaveLength(16);
    expect(QUEST_1.lootPool).toHaveLength(8);
    expect(QUEST_1.lootPool.some((id) => id in LOOT_2)).toBe(false);
  });

  it('shares no monster id with Quest 1, so a Survival fight resolves to exactly one template', () => {
    const ids = QUESTS.flatMap((q) => q.encounters.map((e) => e.monsterId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(QUESTS).toEqual([QUEST_1, QUEST_2]);
    expect(QUEST_1.skill).toBe('times-table');
    expect(QUEST_1.requires).toBeNull();
    expect(findTemplate(QUEST_2.id, 'sum-o')).toBe(QUEST_2.encounters[5]);
    expect(findTemplate(QUEST_1.id, 'sum-o')).toBeNull();
    expect(findTemplate(SURVIVAL_QUEST_ID, 'gob-nine')!.skill).toBe('times-table');
  });
});
```

In `src/content/quest1.test.ts`:
- change the Loot test so it reads `expect(Object.keys(LOOT)).toHaveLength(16);` and compares each Encounter's pool with `QUEST_1.lootPool`, asserting `QUEST_1.lootPool` equals the eight Quest 1 ids `['star-hat', 'moon-hat', 'nine-eye-monocle', 'rusty-gauntlet', 'spider-silk-scarf', 'bat-wing-cloak', 'ink-staff', 'owl-feather-quill']`;
- replace the body of the art test so Quest 2 art is expected only once its master exists:

```ts
  it('ships every piece of art as a WebP with a PNG master in art-src, and no PNG in public/art', () => {
    // Lazy globs: only the keys are read, so nothing is loaded. The size budget lives in scripts/shrink.py.
    const shipped = Object.keys(import.meta.glob('/public/art/**/*'));
    const masters = Object.keys(import.meta.glob('/art-src/**/*.png'));
    const questSlugs = (q: Quest) => [
      `background/${q.background}`,
      ...q.encounters.map((e) => `monster/${e.monsterId}`),
      ...q.lootPool.map((id) => `loot/${id}`),
    ];
    const required = [...questSlugs(QUEST_1), ...PORTRAITS.map((p) => `character/${p}`)];
    // Quest 2 art arrives after the code: a slug is required as soon as its master is committed.
    const arrived = questSlugs(QUEST_2).filter((f) => masters.includes(`/art-src/${f}.png`));
    expect(shipped.sort()).toEqual([...required, ...arrived].map((f) => `/public/art/${f}.webp`).sort());
    for (const f of required) expect(masters, f).toContain(`/art-src/${f}.png`);
  });
```

Import `type Quest` from `./quest1` and `QUEST_2` from `./quest2` in that file.

Add to `src/game/quest.test.ts` (it has a `record(...)` helper that builds an `EncounterRecord`; check its parameter order in the file and use it):

```ts
describe('questOpen', () => {
  const NOW = new Date('2026-09-18T12:00:00Z');
  const wonAll = (): SaveData => ({
    ...emptySave('noah'),
    encounters: QUEST_1.encounters.map((e) => ({
      id: e.monsterId, questId: QUEST_1.id, monsterId: e.monsterId, monsterMaxHp: e.monsterMaxHp,
      startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status: 'won' as const, xp: 1, loot: null,
    })),
  });

  it('always opens Quest 1, and Quest 2 only once Quest 1 is complete', () => {
    expect(openQuests(emptySave('noah'))).toEqual([QUEST_1]);
    const almost = { ...wonAll(), encounters: wonAll().encounters.slice(0, 6) };
    expect(questOpen(almost, QUEST_2)).toBe(false);
    expect(openQuests(wonAll())).toEqual([QUEST_1, QUEST_2]);
  });

  it('opens Quest 2 early when the Learning Plan unlocks its Skill', () => {
    const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, unlockedSkills: ['multi-digit-multiplication'] });
    expect(questOpen(withLearningPlan(emptySave('noah'), plan, NOW), QUEST_2)).toBe(true);
    const other = parseLearningPlan({ kind: PLAN_KIND, version: 1, unlockedSkills: ['powers'] });
    expect(questOpen(withLearningPlan(emptySave('noah'), other, NOW), QUEST_2)).toBe(false);
  });
});
```

Import `openQuests, questOpen` from `./quest`, `QUEST_2` from `../content/quest2`, `parseLearningPlan, PLAN_KIND` from `./learningPlan`, and `emptySave, withLearningPlan, type SaveData` from `../storage/save` as needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/content src/game/quest.test.ts`
Expected: FAIL, cannot resolve `./quest2`.

- [ ] **Step 3: Add the Skill to templates and Quests**

`src/content/index.ts`: add `import type { SkillId } from '../engine/types';` and `skill: SkillId;` to `EncounterTemplate`.

`src/content/quest1.ts`:
- import `Skill, type SkillId` from `'../engine/types'` and `LOOT_2, QUEST_2` from `'./quest2'`;
- add to `Quest`: `skill: SkillId;` and `requires: string | null; // the Quest that must be complete first`;
- rename the existing Loot record to `const LOOT_1` (not exported), keep `LOOT_POOL = Object.keys(LOOT_1)`, and add:

```ts
/** Every Loot id to its display name, across all Quests. Cosmetic only. Ids are stable: they live in the save's records. */
export const LOOT: Record<string, string> = { ...LOOT_1, ...LOOT_2 };
```

- add `skill: Skill.TimesTable` to the object the `encounter` helper returns, and `skill: Skill.TimesTable, requires: null,` to `QUEST_1`;
- change `const QUESTS: Quest[] = [QUEST_1];` to:

```ts
/** Every Quest in campaign order. */
export const QUESTS: Quest[] = [QUEST_1, QUEST_2];
```

- [ ] **Step 4: Write Quest 2**

Create `src/content/quest2.ts`:

```ts
import { Skill } from '../engine/types';
// Types only: quest1.ts imports this module at runtime for the Quest registry.
import type { Quest, QuestEncounter } from './quest1';

/** Quest 2's Loot ids to display names. Merged into `LOOT` by quest1.ts. */
export const LOOT_2: Record<string, string> = {
  'gear-goggles': 'Gear Goggles',
  'brick-boots': 'Brick Boots',
  'ring-of-zeros': 'Ring of Zeros',
  'brass-feather-pen': 'Brass Feather Pen',
  'tens-egg-timer': 'Tens Egg Timer',
  'foundry-apron': 'Foundry Apron',
  'splitting-wand': 'Splitting Wand',
  'golem-heart-lantern': 'Golem-Heart Lantern',
};

const QUEST_ID = 'golem-foundry';
const BACKGROUND = 'foundry-01';
const LOOT_POOL = Object.keys(LOOT_2);

const encounter = (monsterId: string, monsterName: string, monsterMaxHp: number, text: string): QuestEncounter => ({
  questId: QUEST_ID, monsterId, monsterName, monsterMaxHp, lootPool: LOOT_POOL, background: BACKGROUND, skill: Skill.MultiDigit, story: { text },
});

/** Quest 2: seven fights through the foundry to The Grand Product. HP 4 to 8, lower than Quest 1 because a Work grid Spell takes longer. */
export const QUEST_2: Quest = {
  id: QUEST_ID,
  name: 'The Golem Foundry',
  background: BACKGROUND,
  lootPool: LOOT_POOL,
  skill: Skill.MultiDigit,
  requires: 'fortress-of-twelves',
  encounters: [
    encounter('splitter-critter', 'Splitter Critter', 4, 'Below the Fortress an old foundry has started up by itself, and it is building monsters out of numbers. The first one splits in two when it sees you: a tens half and a ones half.'),
    encounter('tens-hen', 'The Tens Hen', 4, 'A clockwork hen struts along the conveyor belt laying eggs in stacks of ten. She counts them before they hatch.'),
    encounter('partial-parrot', 'Partial Parrot', 5, 'A brass parrot repeats only part of everything you say. "Products!" it squawks.'),
    encounter('zero-hero', 'Zero the Hero', 5, 'A small golem in a cape juggles zeros and sticks them on the end of every number he meets. He thinks that makes him ten times braver.'),
    encounter('hundred-pede', 'The Hundred-Pede', 6, 'Something with a hundred iron feet is marching round the furnace in step. It takes a while to turn around.'),
    encounter('sum-o', 'Sum-o', 7, 'A huge round golem stamps the floor and bows. He adds up everything he has eaten today, and it is a lot.'),
    encounter('grand-product', 'The Grand Product', 8, 'At the heart of the foundry stand four great blocks stacked into one giant. Every block is a piece of the answer.'),
  ],
  closing: { text: 'The Grand Product comes apart into four tidy blocks and the furnace goes quiet. You knew how to take a big number to pieces, and how to put it back.' },
};
```

The `requires` value is a literal because importing `QUEST_1` would create a runtime cycle; the Quest 2 test pins it to `QUEST_1.id`.

- [ ] **Step 5: What opens a Quest**

In `src/game/quest.ts` change the type import to `import { QUESTS, type Quest } from '../content/quest1';` and add:

```ts
/** A Quest is open when it requires nothing, when the Quest it requires is complete, or when the Learning Plan unlocks its Skill. */
export function questOpen(save: SaveData, quest: Quest): boolean {
  if (quest.requires === null) return true;
  if (save.learningPlan?.plan.unlockedSkills?.includes(quest.skill)) return true;
  const required = QUESTS.find((q) => q.id === quest.requires);
  return required !== undefined && questComplete(save, required);
}

/** The Quests the Player may enter, in campaign order. */
export const openQuests = (save: SaveData): Quest[] => QUESTS.filter((q) => questOpen(save, q));
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass. If the typecheck reports a test that builds an `EncounterTemplate` literal without `skill`, add `skill: 'times-table'` there.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: Quest 2 content, the Golem Foundry, and the rule that opens it"
```

---

### Task 5: Serving Tiers, table Review, and casting with Work

**Files:**
- Modify: `src/game/play.ts`, `src/game/play.test.ts`

**Interfaces:**
- Consumes: `openTiers`, `TIERS`, `multiDigitProblem`, `isWorkCorrect` (Task 1); `thresholdFor(save, id)` (Task 2); `SpellInput` grid fields (Task 3); `findTemplate`, `QUEST_2`, `EncounterTemplate.skill` (Task 4).
- Produces:
  - `nextProblem(save, encounter, now, rng?)`: same signature. It reads the Encounter's Skill through `findTemplate(encounter.spec.questId, encounter.spec.monsterId)`; an unresolvable template counts as times table.
  - `GridEntry { entered: (number | null)[]; labelsShown: boolean }`.
  - `cast(save, encounter, template, problem, answer, durationMs, now, rng?, grid?: GridEntry)`.
  - `shouldNudgeLabels(encounter: Encounter): boolean`.
  - `REVIEW_SHARE = 0.2`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game/play.test.ts`. Reuse the file's existing `NOW` and seeded `rng` helper if it has them; otherwise define them as below.

```ts
describe('Quest 2 selection and casting', () => {
  const NOW2 = new Date('2026-09-18T12:00:00.000Z');
  const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const base = () => withCharacter(emptySave('noah'), 'Noah', 'character-01');
  const Q2 = QUEST_2.encounters[0]!;

  // Every table Fact Mastered just now, so none is Due or in Learning.
  const tableMastered = (): SaveData => {
    const attempts: Attempt[] = [];
    for (const f of timesTableFacts()) {
      for (let i = 0; i < 3; i++) {
        attempts.push({ factId: f.id, answer: f.a * f.b, correct: true, durationMs: 900, at: NOW2.toISOString(), encounterId: 'old', outcome: 'critical' });
      }
    }
    return { ...base(), attempts };
  };

  it('never serves a grid in Quest 1 or Survival (invariant 7)', () => {
    const rng = seeded(11);
    for (const template of [QUEST_1_FIRST, findTemplate(SURVIVAL_QUEST_ID, 'gob-nine')!]) {
      const { save, encounter } = beginEncounter(base(), template, NOW2, 'e1');
      for (let i = 0; i < 200; i++) expect(nextProblem(save, encounter, NOW2, rng).skill).toBe('times-table');
    }
  });

  it('serves only grids in Quest 2 when no table Fact is Due or in Learning (invariant 7)', () => {
    const rng = seeded(5);
    const { save, encounter } = beginEncounter(tableMastered(), Q2, NOW2, 'e1');
    for (let i = 0; i < 200; i++) {
      const p = nextProblem(save, encounter, NOW2, rng);
      expect(p.factId).toBe('md:2x1');
      expect(p.work).toHaveLength(2);
    }
  });

  it('mixes in about one table Problem in five when table Facts are still in Learning', () => {
    const rng = seeded(9);
    const { save, encounter } = beginEncounter(base(), Q2, NOW2, 'e1');
    let table = 0;
    for (let i = 0; i < 1000; i++) if (nextProblem(save, encounter, NOW2, rng).skill === 'times-table') table++;
    expect(table).toBeGreaterThan(140);
    expect(table).toBeLessThan(260);
  });

  it('serves the next Tier once the one before is Mastered', () => {
    const fast = (i: number): Attempt => ({
      factId: 'md:2x1', answer: 1, correct: true, durationMs: 5000, at: new Date(NOW2.getTime() + i).toISOString(),
      encounterId: 'old', outcome: 'critical', operands: [12, 3], work: [6, 30], labelsShown: false,
    });
    const data = tableMastered();
    const save0 = { ...data, attempts: [...data.attempts, ...[0, 1, 2, 3, 4].map(fast)] };
    const { save, encounter } = beginEncounter(save0, Q2, NOW2, 'e1');
    const seen = new Set<string>();
    const rng = seeded(2);
    for (let i = 0; i < 100; i++) seen.add(nextProblem(save, encounter, NOW2, rng).factId);
    expect([...seen].sort()).toEqual(['md:2x1', 'md:3x1']);
  });

  it('a right answer with wrong Work is a Glancing Blow that never masters the Tier (invariant 2)', () => {
    let { save, encounter } = beginEncounter(tableMastered(), { ...Q2, monsterMaxHp: 50 }, NOW2, 'e1');
    const rng = seeded(4);
    for (let i = 0; i < 6; i++) {
      const p = nextProblem(save, encounter, NOW2, rng);
      const wrong = p.work!.map((c, j) => (j === 0 ? c.value + 1 : c.value));
      const r = cast(save, encounter, Q2, p, p.answer, 1000, NOW2, rng, { entered: wrong, labelsShown: true });
      expect(r.outcome).toBe('glancing');
      ({ save, encounter } = r);
    }
    expect(encounter.monsterHp).toBe(44);
    const status = statusByFact(save.attempts, 20000, masteryStreakFor);
    expect(status['md:2x1']).toEqual({ state: 'learning', streak: 0, dueAt: null });
  });

  it('records the Problem and the Work on the Attempt, and uses the Tier threshold for a Critical Hit', () => {
    const { save, encounter } = beginEncounter(tableMastered(), Q2, NOW2, 'e1');
    const p = nextProblem(save, encounter, NOW2, seeded(4));
    const entered = p.work!.map((c) => c.value).reverse();
    const quick = cast(save, encounter, Q2, p, p.answer, 19999, NOW2, seeded(1), { entered, labelsShown: false });
    expect(quick.outcome).toBe('critical');
    expect(quick.save.attempts.at(-1)).toMatchObject({ factId: 'md:2x1', operands: p.operands, work: entered, labelsShown: false });
    const slow = cast(save, encounter, Q2, p, p.answer, 20000, NOW2, seeded(1), { entered, labelsShown: false });
    expect(slow.outcome).toBe('hit');
  });

  it('treats a grid Problem cast with no Work as a Glancing Blow, and a wrong answer as a Miss whatever the Work', () => {
    const { save, encounter } = beginEncounter(tableMastered(), Q2, NOW2, 'e1');
    const p = nextProblem(save, encounter, NOW2, seeded(4));
    expect(cast(save, encounter, Q2, p, p.answer, 1000, NOW2, seeded(1)).outcome).toBe('glancing');
    const right = p.work!.map((c) => c.value);
    expect(cast(save, encounter, Q2, p, p.answer + 1, 1000, NOW2, seeded(1), { entered: right, labelsShown: true }).outcome).toBe('miss');
  });

  it('nudges only after a win with labels shown and no Glancing Blow', () => {
    const spell = (extra: Partial<Attempt>): Attempt => ({
      factId: 'md:2x1', answer: 1, correct: true, durationMs: 1, at: NOW2.toISOString(), encounterId: 'e1', outcome: 'hit',
      operands: [12, 3], work: [6, 30], labelsShown: true, ...extra,
    });
    const won = (spells: Attempt[]) => ({ ...beginEncounter(base(), Q2, NOW2, 'e1').encounter, status: 'won' as const, spells });
    expect(shouldNudgeLabels(won([spell({})]))).toBe(true);
    expect(shouldNudgeLabels(won([spell({ labelsShown: false })]))).toBe(false);
    expect(shouldNudgeLabels(won([spell({}), spell({ outcome: 'glancing' })]))).toBe(false);
    expect(shouldNudgeLabels({ ...won([spell({})]), status: 'retreated' })).toBe(false);
    const table: Attempt = { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1, at: NOW2.toISOString(), encounterId: 'e1', outcome: 'hit' };
    expect(shouldNudgeLabels(won([table]))).toBe(false);
  });
});
```

Imports this block needs in `play.test.ts`: `cast, nextProblem, beginEncounter, shouldNudgeLabels` from `./play`; `QUEST_2` from `../content/quest2`; `findTemplate, SURVIVAL_QUEST_ID` from `../content/quest1`; `QUEST_1_FIRST` from `../content`; `timesTableFacts` from `../engine/timesTable`; `statusByFact` from `../engine/mastery`; `masteryStreakFor` from `../engine/rows`; `emptySave, withCharacter, type SaveData` from `../storage/save`; `type Attempt` from `../engine/types`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/play.test.ts`
Expected: FAIL. `shouldNudgeLabels` is not exported and Quest 2 serves table Problems only.

- [ ] **Step 3: Implement**

In `src/game/play.ts` add imports:

```ts
import { findTemplate } from '../content/quest1';
import { isWorkCorrect, multiDigitProblem, openTiers, TIERS } from '../engine/multiDigit';
import { Outcome, Skill, type Attempt, type Fact, type Problem } from '../engine/types';
```

(merge with the existing `types` import; `Outcome` becomes a value import.) Replace `nextProblem` and `cast`, and add the rest:

```ts
// One Spell in five of a multi-digit Encounter is table Review, while any table Fact still needs it.
export const REVIEW_SHARE = 0.2;

/** What the Work grid hands to `cast`: the Work cells as entered, and whether the Work labels were ever visible. */
export interface GridEntry {
  entered: (number | null)[];
  labelsShown: boolean;
}

/**
 * Selects the next Problem for this Encounter. A Learning Plan's explicit Problems come first. A
 * multi-digit Encounter then serves an open Tier, or table Review one time in five while a table
 * Fact is Due or in Learning. Every other Encounter serves the table only, so Quest 1 and Survival
 * never show a Work grid.
 */
export function nextProblem(save: SaveData, encounter: Encounter, now: Date, rng: () => number = Math.random): Problem {
  const served = servedFacts(encounter);
  const explicit = nextExplicitProblem(save, served);
  if (explicit) return explicit;
  const status = statusByFact(save.attempts, (id) => thresholdFor(save, id), masteryStreakFor);
  const byFact: Record<string, Attempt[]> = {};
  for (const a of save.attempts) (byFact[a.factId] ??= []).push(a);
  const weight = (f: Fact) => factWeight(byFact[f.id] ?? [], isEmphasized(save, f.id));
  const rows = introducedRows(status);
  const tablePools = buildPools(FACTS, status, (f) => inRows(f, rows), now);

  const skill = findTemplate(encounter.spec.questId, encounter.spec.monsterId)?.skill ?? Skill.TimesTable;
  if (skill === Skill.MultiDigit) {
    const reviewWanted = tablePools.due.length + tablePools.learning.length > 0;
    if (!(reviewWanted && rng() < REVIEW_SHARE)) {
      const open = openTiers(status);
      // With three Tiers the no-repeat rule runs out at once; pickFact then repeats in priority order.
      const tier = pickFact(buildPools(TIERS, status, (t) => open.includes(t), now), weight, served, rng);
      if (!tier) throw new Error('No Tier to serve');
      return multiDigitProblem(tier, rng);
    }
  }
  const fact = pickFact(tablePools, weight, served, rng);
  // 91 Facts and pickFact's exhausted-pool fallback make null unreachable.
  if (!fact) throw new Error('No Fact to serve');
  return timesTableProblem(fact, rng);
}

/**
 * Casts one Spell and returns the new save and Encounter. A Problem with Work is a Glancing Blow
 * unless every Work cell in `grid` is right; a missing `grid` counts as empty Work.
 */
export function cast(
  save: SaveData, encounter: Encounter, template: EncounterTemplate, problem: Problem,
  answer: number | null, durationMs: number, now: Date, rng: () => number = Math.random, grid?: GridEntry,
): { save: SaveData; encounter: Encounter; outcome: Outcome } {
  const entered = grid?.entered ?? [];
  const next = castSpell(encounter, {
    factId: problem.factId, answer, correct: answer === problem.answer, workCorrect: isWorkCorrect(problem, entered), durationMs,
    ...(problem.work && { operands: problem.operands, work: entered, labelsShown: grid?.labelsShown ?? true }),
  }, thresholdFor(save, problem.factId), now);
  const attempt = next.spells[next.spells.length - 1]!;
  const data = withAttempt(save, attempt);
  return {
    save: next.status === EncounterStatus.Active ? withActiveEncounter(data, next) : withEncounter(data, next, rollLootFor(data, template.lootPool, rng)),
    encounter: next,
    outcome: attempt.outcome,
  };
}

/** Whether the result screen should suggest hiding the Work labels: a win where they were shown and all Work was right. */
export const shouldNudgeLabels = (encounter: Encounter): boolean =>
  encounter.status === EncounterStatus.Won
  && encounter.spells.some((s) => s.work !== undefined && s.labelsShown !== false)
  && !encounter.spells.some((s) => s.outcome === Outcome.Glancing);
```

`Outcome` was imported as a type in this file; it is now used as a value, so the import must not be `import type`.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass, including every older `play.test.ts` test unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/game/play.ts src/game/play.test.ts
git commit -m "feat: Quest 2 serves open Tiers with one table Review Spell in five, and casts with Work"
```

---

### Task 6: The Work grid component and the keypad's Next key

**Files:**
- Create: `src/ui/WorkGrid.tsx`, `src/ui/WorkGrid.test.tsx`
- Modify: `src/ui/Keypad.tsx`, `src/ui/Keypad.test.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `Problem` with `work` and `operands` (Task 1); `appendDigit` from `Keypad.tsx`.
- Produces:
  - `appendDigit(value, digit, max = MAX_DIGITS)`.
  - `GRID_MAX_DIGITS = 6`.
  - `Keypad` props gain `onNext?: () => void`, `maxDigits?: number`, `canCast?: boolean`.
  - `WorkGrid` props:

```ts
interface WorkGridProps {
  problem: Problem;            // must have `work` and `operands`
  cells: string[];             // one per Work cell, then the answer last
  active: number;              // index into `cells` that holds focus
  onActive: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onCast: () => void;
  disabled: boolean;
  showLabels: boolean;
  onToggleLabels: () => void;
  marks: boolean[] | null;     // per Work cell after a cast; null while answering
}
```

The grid is fully controlled: it holds no state of its own.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/Keypad.test.tsx`:

```tsx
  it('appendDigit takes a digit cap, defaulting to four', () => {
    expect(appendDigit('1234', '5')).toBe('1234');
    expect(appendDigit('1234', '5', 6)).toBe('12345');
    expect(appendDigit('123456', '7', 6)).toBe('123456');
  });

  it('shows a Next key only when given onNext, and lets canCast override the Cast rule', () => {
    const onNext = vi.fn();
    const { rerender } = render(<Keypad value="" onChange={() => {}} onCast={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    rerender(<Keypad value="" onChange={() => {}} onCast={() => {}} onNext={onNext} canCast />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<Keypad value="12" onChange={() => {}} onCast={() => {}} onNext={onNext} canCast={false} />);
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses maxDigits when typing', () => {
    const onChange = vi.fn();
    render(<Keypad value="1234" onChange={onChange} onCast={() => {}} maxDigits={6} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenCalledWith('12345');
  });
```

Create `src/ui/WorkGrid.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Problem } from '../engine/types';
import { WorkGrid } from './WorkGrid';

afterEach(cleanup);

const problem: Problem = {
  factId: 'md:2x1', skill: 'multi-digit-multiplication', prompt: '47 × 6', answer: 282, operands: [47, 6],
  work: [{ label: '6 × 7', value: 42 }, { label: '6 × 40', value: 240 }],
};

function mount(overrides: Partial<Parameters<typeof WorkGrid>[0]> = {}) {
  const props = {
    problem, cells: ['', '', ''], active: 0, onActive: vi.fn(), onChange: vi.fn(), onCast: vi.fn(),
    disabled: false, showLabels: true, onToggleLabels: vi.fn(), marks: null, ...overrides,
  };
  const view = render(<WorkGrid {...props} />);
  return { ...props, ...view };
}
const cell = (n: number) => screen.getByLabelText(`Work cell ${n}`) as HTMLInputElement;
const answer = () => screen.getByLabelText('Answer') as HTMLInputElement;

describe('WorkGrid', () => {
  it('shows the stacked Problem, one input per Work cell, and the answer', () => {
    mount();
    expect(screen.getByRole('math').getAttribute('aria-label')).toBe('47 × 6');
    expect(cell(1)).toBeTruthy();
    expect(cell(2)).toBeTruthy();
    expect(answer()).toBeTruthy();
    expect(screen.queryByLabelText('Work cell 3')).toBeNull();
  });

  it('focuses the active cell, and moves focus when active changes (invariant 8)', () => {
    const p = mount();
    expect(document.activeElement).toBe(cell(1));
    p.rerender(<WorkGrid {...p} active={2} />);
    expect(document.activeElement).toBe(answer());
  });

  it('reports a tapped or tabbed-to cell as active', () => {
    const p = mount();
    fireEvent.focus(cell(2));
    expect(p.onActive).toHaveBeenCalledWith(1);
  });

  it('types digits and Backspace into the focused cell, up to six digits', () => {
    const p = mount({ cells: ['4', '', ''] });
    fireEvent.keyDown(cell(1), { key: '2' });
    expect(p.onChange).toHaveBeenCalledWith(0, '42');
    fireEvent.keyDown(cell(1), { key: 'Backspace' });
    expect(p.onChange).toHaveBeenCalledWith(0, '');
    cleanup();
    const full = mount({ cells: ['123456', '', ''] });
    fireEvent.keyDown(cell(1), { key: '7' });
    expect(full.onChange).toHaveBeenCalledWith(0, '123456');
  });

  it('Enter moves to the next input, and casts from the answer only when it is filled', () => {
    const p = mount();
    fireEvent.keyDown(cell(1), { key: 'Enter' });
    expect(p.onActive).toHaveBeenCalledWith(1);
    fireEvent.keyDown(answer(), { key: 'Enter' });
    expect(p.onCast).not.toHaveBeenCalled();
    cleanup();
    const filled = mount({ cells: ['', '', '282'], active: 2 });
    fireEvent.keyDown(answer(), { key: 'Enter' });
    expect(filled.onCast).toHaveBeenCalledTimes(1);
  });

  it('shows the Work labels and a Hide button, or no labels and a Show button', () => {
    const p = mount();
    expect(screen.getByText('6 × 40')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide labels' }));
    expect(p.onToggleLabels).toHaveBeenCalledTimes(1);
    cleanup();
    mount({ showLabels: false });
    expect(screen.queryByText('6 × 40')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
  });

  it('after a cast marks wrong cells and lists the right Work with its labels, even when labels are hidden', () => {
    mount({ cells: ['42', '241', '282'], marks: [true, false], disabled: true, showLabels: false });
    expect(cell(1).className).not.toContain('wrong');
    expect(cell(2).className).toContain('wrong');
    const solution = screen.getByRole('list', { name: 'The right Work' });
    expect(solution.textContent).toContain('6 × 7 = 42');
    expect(solution.textContent).toContain('6 × 40 = 240');
    expect((screen.getByRole('button', { name: 'Show labels' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/Keypad.test.tsx src/ui/WorkGrid.test.tsx`
Expected: FAIL, cannot resolve `./WorkGrid`.

- [ ] **Step 3: Keypad**

In `src/ui/Keypad.tsx`:

```tsx
export const MAX_DIGITS = 4;
export const GRID_MAX_DIGITS = 6; // 99 × 99 is four digits; six leaves room to fix a slip without blocking

/** Appends a digit. Never keeps a leading zero and never grows past `max` (screens spec invariant 4). */
export const appendDigit = (value: string, digit: string, max: number = MAX_DIGITS): string =>
  value.length >= max ? value : value === '0' ? digit : value + digit;
```

Add to `KeypadProps`: `onNext?: () => void; maxDigits?: number; canCast?: boolean;`. In the component destructure them (`maxDigits = MAX_DIGITS`), use `appendDigit(value, d, maxDigits)`, disable Cast with `disabled || !(canCast ?? Boolean(value))`, and render before the Cast button:

```tsx
      {onNext && (
        <button type="button" className="key key-next" disabled={disabled} onClick={onNext}>
          Next
        </button>
      )}
```

Give the component a docstring: `/** The on-screen keypad. It types into whatever value it is given; a Work grid also gets a Next key. */`

In `src/ui/styles.css` change the keypad areas line to:

```css
  grid-template-areas: 'k7 k8 k9 back' 'k4 k5 k6 next' 'k1 k2 k3 cast' '. k0 . cast';
```

and add next to the `.key-cast` rule: `.key-next { grid-area: next; font-size: 1rem; }`

- [ ] **Step 4: WorkGrid**

Create `src/ui/WorkGrid.tsx`:

```tsx
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Problem } from '../engine/types';
import { appendDigit, GRID_MAX_DIGITS } from './Keypad';

interface WorkGridProps {
  problem: Problem;
  cells: string[]; // one per Work cell, then the answer last
  active: number;
  onActive: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onCast: () => void;
  disabled: boolean;
  showLabels: boolean;
  onToggleLabels: () => void;
  marks: boolean[] | null; // per Work cell after a cast; null while answering
}

/**
 * The Work grid: the stacked Problem, one input per partial product, and the answer. Fully
 * controlled. Inputs are read-only with inputMode="none" so a touch device's own keyboard stays
 * away while hardware typing, Tab and the on-screen keypad all work.
 */
export function WorkGrid({ problem, cells, active, onActive, onChange, onCast, disabled, showLabels, onToggleLabels, marks }: WorkGridProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const last = cells.length - 1;
  useEffect(() => {
    if (!disabled) refs.current[active]?.focus();
  }, [active, disabled, problem]);

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    const value = cells[i] ?? '';
    if (/^\d$/.test(e.key)) onChange(i, appendDigit(value, e.key, GRID_MAX_DIGITS));
    else if (e.key === 'Backspace') onChange(i, value.slice(0, -1));
    else if (e.key === 'Enter') {
      if (i < last) onActive(i + 1);
      else if (value) onCast();
    } else return;
    e.preventDefault();
  };

  const input = (i: number, label: string, className: string) => (
    <input
      ref={(el) => { refs.current[i] = el; }}
      className={className}
      inputMode="none"
      aria-label={label}
      value={cells[i] ?? ''}
      readOnly
      disabled={disabled}
      onFocus={() => onActive(i)}
      onKeyDown={onKeyDown(i)}
    />
  );

  const [a, b] = problem.operands!;
  const work = problem.work!;
  return (
    <div className="work-grid">
      <div className="stacked" role="math" aria-label={problem.prompt}>
        <span>{a}</span>
        <span>× {b}</span>
      </div>
      <button type="button" className="labels-toggle" onClick={onToggleLabels} disabled={disabled}>
        {showLabels ? 'Hide labels' : 'Show labels'}
      </button>
      {work.map((c, i) => (
        <div key={i} className="work-row">
          {showLabels && <span className="work-label">{c.label}</span>}
          {input(i, `Work cell ${i + 1}`, marks && !marks[i] ? 'answer work-cell wrong' : 'answer work-cell')}
        </div>
      ))}
      <div className="work-row work-answer">
        {input(last, 'Answer', 'answer')}
      </div>
      {marks && (
        <ul className="work-solution" aria-label="The right Work">
          {work.map((c, i) => <li key={i}>{c.label} = {c.value}</li>)}
        </ul>
      )}
    </div>
  );
}
```

Add to `src/ui/styles.css`, after the `.problem` rules:

```css
.work-grid { display: grid; gap: 8px; justify-items: end; }
.stacked { display: grid; justify-items: end; font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.work-row { display: flex; align-items: center; gap: 12px; }
.work-label { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.work-cell { width: 8ch; }
.work-cell.wrong { border-color: var(--miss, #c0392b); background: #fdecea; }
.work-answer { border-top: 4px solid var(--frame); padding-top: 8px; }
.labels-toggle { font-size: 1rem; padding: 4px 12px; }
.work-solution { list-style: none; margin: 0; padding: 8px 12px; border: 3px solid var(--frame); border-radius: 12px; background: #fff; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
```

Check which colour variables exist at the top of `styles.css` and use the file's own name for the Miss colour if there is one.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: Work grid component and a Next key on the keypad"
```

---

### Task 7: The Work grid inside the Encounter screen

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`, `src/ui/EncounterScreen.test.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `WorkGrid`, `Keypad` props `onNext` / `maxDigits` / `canCast`, `GRID_MAX_DIGITS` (Task 6); `cast(..., grid?: GridEntry)` (Task 5); `checkWork` (Task 1); `withHiddenWorkLabels`, `settings.hideWorkLabels` (Task 3); `QUEST_2` (Task 4).
- Produces: no new exports. `EncounterScreen` props are unchanged.

Rules from the spec, all tested below:
- A Problem with `work` shows the `WorkGrid`; any other shows `AnswerInput` as today.
- Focus starts on Work cell 1 for a grid, on the answer box for a table Problem.
- Labels start shown unless `settings.hideWorkLabels`. Hiding them saves the setting at once through `onSave`. Showing them while the setting is true is a peek for this Problem only.
- The Attempt's `labelsShown` is true if the labels were visible at any moment of the Problem.
- A Glancing Blow or a Miss on a grid waits for a focused "Next" button. Everything else times out as today.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/EncounterScreen.test.tsx`:

```tsx
describe('EncounterScreen with a Work grid', () => {
  const Q2 = QUEST_2.encounters[0]!;
  // Every table Fact Mastered just now, so Quest 2 serves only grids.
  const gridOnly = (hide = false): SaveData => {
    const attempts: Attempt[] = [];
    for (const f of timesTableFacts()) {
      for (let i = 0; i < 3; i++) attempts.push({ factId: f.id, answer: f.a * f.b, correct: true, durationMs: 900, at: new Date(T0).toISOString(), encounterId: 'old', outcome: 'critical' });
    }
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    return { ...base, attempts, settings: { hideWorkLabels: hide } };
  };
  function mountGrid(start: SaveData = gridOnly(), hp = 50) {
    const onSave = vi.fn();
    const onFinish = vi.fn();
    const { save, encounter } = beginEncounter(start, { ...Q2, monsterMaxHp: hp }, now(), 'e1');
    render(<EncounterScreen save={save} encounter={encounter} template={Q2} onSave={onSave} onFinish={onFinish} now={now} rng={rng} />);
    return { onSave, onFinish };
  }
  const cell = (n: number) => screen.getByLabelText(`Work cell ${n}`) as HTMLInputElement;
  const key = (d: string) => fireEvent.click(screen.getByRole('button', { name: d }));
  const type = (n: number) => { for (const d of String(n)) key(d); };
  const operands = () => screen.getByRole('math').getAttribute('aria-label')!.match(/\d+/g)!.map(Number) as [number, number];
  const partials = () => { const [a, b] = operands(); return [b * (a % 10), b * (a - (a % 10))]; }; // 2×1 only
  const lastAttempt = (onSave: ReturnType<typeof vi.fn>) => (onSave.mock.calls.at(-1)![0] as SaveData).attempts.at(-1)!;

  it('shows the grid with focus on the first Work cell (invariant 8)', () => {
    mountGrid();
    expect(document.activeElement).toBe(cell(1));
    expect(screen.queryByText(/=$/)).toBeNull();
  });

  it('types into the focused cell, moves on with Next, and any order of right Work is a Hit', () => {
    const { onSave } = mountGrid();
    const [ones, tens] = partials();
    const [a, b] = operands();
    type(tens!);
    expect(cell(1).value).toBe(String(tens));
    key('Next');
    expect(document.activeElement).toBe(cell(2));
    type(ones!);
    key('Next');
    expect(document.activeElement).toBe(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(['hit', 'critical']).toContain(lastAttempt(onSave).outcome);
    expect(lastAttempt(onSave)).toMatchObject({ operands: [a, b], work: [tens, ones], labelsShown: true });
    // Only the keypad's own Next key: a Hit does not wait for the Player.
    expect(screen.getAllByRole('button', { name: 'Next' })).toHaveLength(1);
  });

  it('Cast needs only the answer; empty Work is a Glancing Blow that waits for Next', () => {
    const { onSave } = mountGrid();
    const [a, b] = operands();
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(lastAttempt(onSave)).toMatchObject({ outcome: 'glancing', work: [null, null] });
    expect(screen.getByRole('status').textContent).toBe('Glancing Blow!');
    expect(screen.getByRole('list', { name: 'The right Work' })).toBeTruthy();
    expect(cell(1).className).toContain('wrong');
    clearFeedback(60_000);
    expect(screen.getByRole('status').textContent).toBe('Glancing Blow!');
    const next = screen.getAllByRole('button', { name: 'Next' }).find((b) => b.className.includes('primary'))!;
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    expect(screen.queryByRole('status')).toBeNull();
    expect(cell(1).value).toBe('');
    expect(document.activeElement).toBe(cell(1));
  });

  it('a Miss on a grid shows the answer and the right Work, and waits for Next', () => {
    mountGrid();
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b + 1);
    key('Cast');
    expect(screen.getByRole('status').textContent).toBe(`Miss. ${a} × ${b} = ${a * b}`);
    expect(screen.getByRole('list', { name: 'The right Work' })).toBeTruthy();
    clearFeedback(60_000);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('hiding the labels saves the setting at once, and the Attempt still says they were shown (invariants 4 and 5)', () => {
    const { onSave } = mountGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Hide labels' }));
    expect((onSave.mock.calls.at(-1)![0] as SaveData).settings.hideWorkLabels).toBe(true);
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(lastAttempt(onSave).labelsShown).toBe(true);
  });

  it('with labels hidden by default, a Problem records labelsShown false', () => {
    const { onSave } = mountGrid(gridOnly(true));
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(lastAttempt(onSave).labelsShown).toBe(false);
  });

  it('a peek lasts one Problem, never changes the setting, and is recorded even if closed again (invariants 4 and 5)', () => {
    const { onSave } = mountGrid(gridOnly(true));
    fireEvent.click(screen.getByRole('button', { name: 'Show labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide labels' }));
    expect(onSave).not.toHaveBeenCalled();
    const [ones, tens] = partials();
    const [a, b] = operands();
    type(ones!); key('Next'); type(tens!); key('Next'); type(a * b);
    key('Cast');
    const saved = onSave.mock.calls.at(-1)![0] as SaveData;
    expect(saved.attempts.at(-1)!.labelsShown).toBe(true);
    expect(saved.settings.hideWorkLabels).toBe(true);
    clearFeedback(FEEDBACK_MS.hit);
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
  });

  it('a table Problem inside Quest 2 uses the single answer box, focused (invariant 8)', () => {
    const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, problems: [[7, 8]] });
    mountGrid(withLearningPlan(gridOnly(), plan, new Date(T0 - 1000)));
    expect(screen.getByText('7 × 8 =')).toBeTruthy();
    expect(screen.queryByRole('math')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Answer'));
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('finishes the Encounter from the Next button after a final Glancing Blow', () => {
    const { onFinish } = mountGrid(gridOnly(), 1);
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Next' }).find((x) => x.className.includes('primary'))!);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
```

Imports this block needs: `QUEST_2` from `../content/quest2`; `timesTableFacts` from `../engine/timesTable`; `type Attempt` from `../engine/types`; `parseLearningPlan, PLAN_KIND` from `../game/learningPlan`; `withLearningPlan, type SaveData` from `../storage/save`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/EncounterScreen.test.tsx`
Expected: FAIL. No element with the label "Work cell 1".

- [ ] **Step 3: Implement**

In `src/ui/EncounterScreen.tsx`:

Imports to add: `checkWork` from `'../engine/multiDigit'`; `withHiddenWorkLabels` from `'../storage/save'`; `GRID_MAX_DIGITS, Keypad` from `'./Keypad'`; `WorkGrid` from `'./WorkGrid'`.

Extend `Feedback` with `marks: boolean[] | null;`.

Replace the `value` state and `doCast`, and the feedback effect, with:

```tsx
  // One string per input: a table Problem has just the answer; a grid has its Work cells, then the answer.
  const blank = (p: Problem) => Array<string>((p.work?.length ?? 0) + 1).fill('');
  const [cells, setCells] = useState(() => blank(problem));
  const [active, setActive] = useState(0);
  const [peek, setPeek] = useState(false);
  // True if the Work labels were visible at any moment of this Problem, even a peek closed before casting.
  const [labelsSeen, setLabelsSeen] = useState(() => !save.settings.hideWorkLabels);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const grid = problem.work !== undefined;
  const last = cells.length - 1;
  const showLabels = !state.save.settings.hideWorkLabels || peek;
  const setCell = (i: number, v: string) => setCells((cs) => cs.map((c, j) => (j === i ? v : c)));

  /** Hiding sets the Player's default at once; showing while hidden is the default is a peek for this Problem only. */
  const toggleLabels = () => {
    if (!showLabels) {
      setPeek(true);
      setLabelsSeen(true);
      return;
    }
    setPeek(false);
    if (!state.save.settings.hideWorkLabels) {
      const hidden = withHiddenWorkLabels(state.save);
      setState({ ...state, save: hidden });
      onSave(hidden, state.encounter);
    }
  };

  /** Casts a submitted answer and reports the resulting save and Encounter before feedback clears. */
  const doCast = () => {
    const answer = cells[last];
    if (!answer || feedback) return;
    const at = now();
    const entered = cells.slice(0, last).map((c) => (c === '' ? null : Number(c)));
    // Clamped: a device clock stepping back mid-Problem must never store a negative duration (PR #13).
    const result = cast(
      state.save, state.encounter, template, problem, Number(answer), Math.max(0, at.getTime() - shownAt), at, rng,
      grid ? { entered, labelsShown: labelsSeen } : undefined,
    );
    setState(result);
    onSave(result.save, result.encounter);
    setFeedback({ outcome: result.outcome, problem, marks: problem.work ? checkWork(problem.work.map((c) => c.value), entered) : null });
  };

  /** Clears the feedback, then either ends the Encounter or serves the next Problem with its inputs reset. */
  const advance = () => {
    setFeedback(null);
    if (state.encounter.status !== EncounterStatus.Active) {
      onFinish(state.save, state.encounter);
      return;
    }
    const next = nextProblem(state.save, state.encounter, now(), rng);
    setProblem(next);
    setCells(blank(next));
    setActive(0);
    setPeek(false);
    setLabelsSeen(!state.save.settings.hideWorkLabels);
    setShownAt(now().getTime());
  };

  // A Glancing Blow or a Miss on a grid has Work to read, so it waits for the Next button instead of a timer.
  const waits = feedback !== null && feedback.marks !== null && (feedback.outcome === Outcome.Glancing || feedback.outcome === Outcome.Miss);

  useEffect(() => {
    if (!feedback || waits) return;
    const timer = setTimeout(advance, feedback.outcome === Outcome.Miss ? FEEDBACK_MS.miss : FEEDBACK_MS.hit);
    return () => clearTimeout(timer);
  }, [feedback]);
```

Replace the `problem` section and the keypad in the JSX with:

```tsx
      <section className="problem">
        {grid ? (
          <WorkGrid
            problem={problem} cells={cells} active={active} onActive={setActive} onChange={setCell} onCast={doCast}
            disabled={locked} showLabels={showLabels} onToggleLabels={toggleLabels} marks={feedback?.marks ?? null}
          />
        ) : (
          <>
            <span className="prompt">{problem.prompt} =</span>
            <AnswerInput value={cells[0] ?? ''} onChange={(v) => setCell(0, v)} onCast={doCast} disabled={locked} focusKey={problem} />
          </>
        )}
        {waits && <button type="button" className="primary" onClick={advance} autoFocus>Next</button>}
      </section>
      <Keypad
        value={cells[active] ?? ''} onChange={(v) => setCell(active, v)} onCast={doCast} disabled={locked}
        onNext={grid ? () => setActive((i) => Math.min(i + 1, last)) : undefined}
        maxDigits={grid ? GRID_MAX_DIGITS : undefined}
        canCast={Boolean(cells[last])}
      />
```

Add the class `with-grid` to `<main>` when `grid` is true: ``className={grid ? 'screen encounter with-grid' : 'screen encounter'}``.

In `src/ui/styles.css`, after the `.encounter` rules and before the narrow-screen media query, add a three-column layout for the grid so nothing scrolls on a 1366 × 768 Chromebook:

```css
.encounter.with-grid { grid-template-columns: minmax(0, 1.4fr) auto auto; grid-template-areas: 'status status status' 'panel problem keypad'; }
.encounter.with-grid .problem { flex-direction: column; align-items: end; align-self: center; }
```

Inside the existing `@media (max-width: ...)` block that stacks `.encounter`, add `.encounter.with-grid { grid-template-columns: 1fr; grid-template-areas: 'status' 'panel' 'problem' 'keypad'; }` so the narrow layout still stacks.

A table Problem keeps `active` at 0 and `last` at 0, so the keypad types into the answer as before.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass, including every older Encounter and Survival screen test unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat: the Encounter screen casts through the Work grid, with labels the Player can hide"
```

---

### Task 8: Six Achievements

**Files:**
- Modify: `src/game/achievements.ts`, `src/game/achievements.test.ts`
- Modify: `src/ui/TrophyCaseScreen.test.tsx` (only if it hard-codes 19)

**Interfaces:**
- Consumes: `TIERS`, `isTierId` (Task 1); `achievementThresholdFor(save, id)` (Task 2); `Attempt.work`, `Attempt.labelsShown` (Task 1); `QUEST_2` (Task 4).
- Produces: `ACHIEVEMENT_COUNT` is 25. New ids: `tier-md-2x1`, `tier-md-3x1`, `tier-md-2x2`, `skill-multi-digit`, `second-quest`, `no-labels`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game/achievements.test.ts`. The file has helpers for building saves; the block below is self-contained so it does not depend on them.

```ts
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
```

Imports this block needs: `ACHIEVEMENT_COUNT, achievements` from `./achievements`; `QUEST_2` from `../content/quest2`; `emptySave, type EncounterRecord, type SaveData` from `../storage/save`; `type Attempt` from `../engine/types`.

Then run `grep -rn "19" src/game/achievements.test.ts src/ui/TrophyCaseScreen.test.tsx` and change any assertion that means "the number of Achievements" to 25 (for example `of 19` becomes `of 25`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/achievements.test.ts`
Expected: FAIL, `ACHIEVEMENT_COUNT` is 19.

- [ ] **Step 3: Implement**

In `src/game/achievements.ts`:

```ts
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { isTierId, TIERS, type TierId } from '../engine/multiDigit';
```

Extend `Id` and add the helpers:

```ts
const Id = {
  FirstHit: 'first-hit', FirstCritical: 'first-critical', FiveCriticals: 'five-criticals', Flawless: 'flawless-encounter',
  Skill: 'skill-times-table', FirstQuest: 'first-quest',
  MultiDigitSkill: 'skill-multi-digit', SecondQuest: 'second-quest', NoLabels: 'no-labels',
} as const;
const tierAchievementId = (id: TierId) => `tier-${id.replace(':', '-')}`; // md:2x1 -> tier-md-2x1
const TIER_NAMES: Record<TierId, string> = { 'md:2x1': 'Two by One', 'md:3x1': 'Three by One', 'md:2x2': 'Two by Two' };
const NO_LABELS_RUN = 10;
const QUEST_ACHIEVEMENTS = [{ quest: QUEST_1, id: Id.FirstQuest }, { quest: QUEST_2, id: Id.SecondQuest }];
```

Append to `DEFINITIONS`, after the `FirstQuest` entry:

```ts
  ...TIERS.map((t) => ({ id: tierAchievementId(t.id), name: TIER_NAMES[t.id], hint: `Master ${t.name} multiplication.` })),
  { id: Id.MultiDigitSkill, name: 'Multiplication Master', hint: 'Master every multi-digit Tier.' },
  { id: Id.SecondQuest, name: 'Foundry Cooled', hint: 'Finish the Golem Foundry.' },
  { id: Id.NoLabels, name: 'No Labels', hint: `Win ${NO_LABELS_RUN} Encounters in a row with the Work labels hidden.` },
```

Inside `achievements`, add `const tiersMastered = new Set<FactId>();` and `const gridEncounters = new Map<string, boolean>(); // encounter id -> a Work label was shown` beside the other collections. Inside the `for (const a of save.attempts)` loop, after the table block, add:

```ts
    if (isTierId(a.factId)) {
      (byFact[a.factId] ??= []).push(a);
      const status = factStatus(byFact[a.factId]!, achievementThresholdFor(save, a.factId), masteryStreakFor(a.factId));
      if (status.state === MasteryState.Mastered) {
        tiersMastered.add(a.factId);
        first(tierAchievementId(a.factId), a.at);
      } else tiersMastered.delete(a.factId);
      if (tiersMastered.size === TIERS.length) first(Id.MultiDigitSkill, a.at);
    }
    // A grid Attempt without the flag predates nothing, but a damaged save must never earn the trophy for it.
    if (a.work !== undefined) gridEncounters.set(a.encounterId, (gridEncounters.get(a.encounterId) ?? false) || a.labelsShown !== false);
```

Replace the single Quest 1 block at the end with a loop, and add the run:

```ts
  for (const { quest, id } of QUEST_ACHIEVEMENTS) {
    if (!questComplete(save, quest)) continue;
    const boss = quest.encounters[quest.encounters.length - 1]!;
    const win = save.encounters.find((r) => r.questId === quest.id && r.monsterId === boss.monsterId && r.status === EncounterStatus.Won);
    if (win) first(id, win.endedAt);
  }

  // Only Encounters with a Work grid Spell count; a Retreat or one label shown starts the run again.
  let run = 0;
  for (const r of save.encounters) {
    const labelShown = gridEncounters.get(r.id);
    if (labelShown === undefined) continue;
    run = r.status === EncounterStatus.Won && !labelShown ? run + 1 : 0;
    if (run === NO_LABELS_RUN) first(Id.NoLabels, r.endedAt);
  }
```

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: six Achievements for Tiers, the Skill, Quest 2 and playing with no Work labels"
```

---

### Task 9: The Quest list, per-Quest routing, the nudge, and one whole fight

**Files:**
- Create: `src/ui/QuestListScreen.tsx`, `src/ui/QuestListScreen.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`
- Modify: `src/ui/ResultScreen.tsx`, `src/ui/ResultScreen.test.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `openQuests` (Task 4); `QUESTS` (Task 4); `shouldNudgeLabels` (Task 5); everything the Encounter screen does (Task 7).
- Produces: `QuestListScreen({ quests, onPick, onTitle })`. `App` keeps its props.

Routing rules:
- Play with an open Encounter resumes it, and the current Quest becomes that Encounter's Quest.
- Play with one open Quest goes straight to its Quest screen. With more than one it shows the Quest list.
- The Quest, Story and Closing screens use the current Quest. The result screen's Continue goes to the closing panel after that Quest's boss is won, to that Quest's screen after any other Quest fight, and to the Title after a Survival fight.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/QuestListScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { QuestListScreen } from './QuestListScreen';

afterEach(cleanup);

describe('QuestListScreen', () => {
  it('lists the open Quests by name, focuses the newest, and reports a pick', () => {
    const onPick = vi.fn();
    const onTitle = vi.fn();
    render(<QuestListScreen quests={[QUEST_1, QUEST_2]} onPick={onPick} onTitle={onTitle} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'The Golem Foundry' }));
    fireEvent.click(screen.getByRole('button', { name: 'The Fortress of Twelves' }));
    expect(onPick).toHaveBeenCalledWith(QUEST_1);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalledTimes(1);
  });
});
```

Add to `src/ui/ResultScreen.test.tsx`:

```tsx
  it('suggests hiding the Work labels after a win where they were shown and all Work was right', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    const Q2 = QUEST_2.encounters[0]!;
    let { save, encounter } = beginEncounter(base, { ...Q2, monsterMaxHp: 1 }, NOW, 'e1');
    const p = { factId: 'md:2x1', skill: 'multi-digit-multiplication' as const, prompt: '12 × 3', answer: 36, operands: [12, 3] as [number, number], work: [{ label: '3 × 2', value: 6 }, { label: '3 × 10', value: 30 }] };
    ({ save, encounter } = cast(save, encounter, Q2, p, 36, 60000, NOW, () => 0, { entered: [30, 6], labelsShown: true }));
    const { rerender } = render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.getByText('All your Work was right. Try the next fight with the labels hidden!')).toBeTruthy();
    const hidden = { ...encounter, spells: encounter.spells.map((s) => ({ ...s, labelsShown: false })) };
    rerender(<ResultScreen save={save} encounter={hidden} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.queryByText(/labels hidden/)).toBeNull();
  });
```

Import `QUEST_2` from `../content/quest2` and `cast` from `../game/play` there if missing.

Add to `src/App.test.tsx`. It follows the file's own pattern: a `memoryStore`, `render(<App ... />)`, and fake timers inside `try`/`finally`.

```tsx
describe('Quest 2 through the real screens (invariant 10)', () => {
  const T = Date.parse('2026-09-18T12:00:00.000Z');
  const iso = new Date(T).toISOString();
  // Quest 1 complete and every table Fact Mastered just now, so Quest 2 serves only grids unless a plan says otherwise.
  const ready = (): SaveData => {
    const attempts: Attempt[] = [];
    for (const f of timesTableFacts()) {
      for (let i = 0; i < 3; i++) attempts.push({ factId: f.id, answer: f.a * f.b, correct: true, durationMs: 900, at: iso, encounterId: 'old', outcome: 'critical' });
    }
    return {
      ...named(),
      attempts,
      encounters: QUEST_1.encounters.map((e) => ({
        id: `q1-${e.monsterId}`, questId: QUEST_1.id, monsterId: e.monsterId, monsterMaxHp: e.monsterMaxHp,
        startedAt: iso, endedAt: iso, status: 'won' as const, xp: 1, loot: null,
      })),
    };
  };
  const key = (d: string) => fireEvent.click(screen.getByRole('button', { name: d }));
  const type = (n: number) => { for (const d of String(n)) key(d); };
  const operands = () => screen.getByRole('math').getAttribute('aria-label')!.match(/\d+/g)!.map(Number) as [number, number];

  it('Play lists both Quests; a Quest 2 fight has a table Review Spell, a Glancing Blow, a win and Quest 2 Loot', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let clock = T + 60_000;
      // One explicit table Problem makes a Review Spell certain; the scale makes the monster's HP 2.
      const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, problems: [[7, 8]], monsterHpScale: 0.5 });
      const store = memoryStore();
      await store.save(withLearningPlan(ready(), plan, new Date(T)));
      render(<App store={store} now={() => new Date(clock)} rng={() => 0.5} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'The Golem Foundry' }));
      fireEvent.click(screen.getByRole('button', { name: 'The Golem Foundry' }));
      expect(screen.getByRole('heading', { name: 'The Golem Foundry' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Splitter Critter/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Fight' }));

      // Spell 1: the plan's table Problem in the single answer box. Answered slowly, so it is a Hit for 1, not a Critical for 2.
      expect(await screen.findByText('7 × 8 =')).toBeTruthy();
      expect(screen.queryByRole('math')).toBeNull();
      clock += 5000;
      type(56);
      key('Cast');
      expect(screen.getByRole('status').textContent).toBe('Hit!');
      act(() => { vi.advanceTimersByTime(1500); });

      // Spell 2: a grid with focus on its first Work cell. Empty Work with a right answer is a Glancing Blow that waits.
      expect(document.activeElement).toBe(screen.getByLabelText('Work cell 1'));
      const [a, b] = operands();
      fireEvent.focus(screen.getByLabelText('Answer'));
      type(a * b);
      key('Cast');
      expect(screen.getByRole('status').textContent).toBe('Glancing Blow!');
      expect(screen.getByRole('list', { name: 'The right Work' })).toBeTruthy();
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(screen.queryByRole('heading', { name: 'Victory!' })).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: 'Next' }).find((x) => x.className.includes('primary'))!);

      expect(await screen.findByRole('heading', { name: 'Victory!' })).toBeTruthy();
      expect(screen.getByText(/You found the/).textContent).toMatch(/Gear Goggles|Brick Boots|Ring of Zeros|Brass Feather Pen|Tens Egg Timer|Foundry Apron|Splitting Wand|Golem-Heart Lantern/);
      const saved = (await store.load())!;
      expect(saved.encounters.at(-1)).toMatchObject({ questId: 'golem-foundry', monsterId: 'splitter-critter', status: 'won' });
      expect(saved.attempts.at(-1)).toMatchObject({ factId: 'md:2x1', outcome: 'glancing', operands: [a, b], work: [null, null], labelsShown: true });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('heading', { name: 'The Golem Foundry' })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Splitter Critter/ }).textContent).toContain('Won');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes an open Quest 2 Encounter into its grid', async () => {
    const begun = beginEncounter(ready(), QUEST_2.encounters[0]!, new Date(T), 'open');
    const store = memoryStore();
    await store.save(begun.save);
    render(<App store={store} now={() => new Date(T)} rng={() => 0.5} />);
    // The title's primary button reads Continue while an Encounter is open.
    fireEvent.click(await screen.findByRole('button', { name: /^(Continue|Play)$/ }));
    expect(await screen.findByLabelText('Work cell 1')).toBeTruthy();
  });

  it('Play still goes straight to Quest 1 while it is the only open Quest', async () => {
    const store = memoryStore();
    await store.save(named());
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    expect(await screen.findByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
  });
});
```

Imports this block needs in `src/App.test.tsx`: `QUEST_2` from `./content/quest2`; `timesTableFacts` from `./engine/timesTable`; `type Attempt` from `./engine/types`; `parseLearningPlan, PLAN_KIND` from `./game/learningPlan`; `withLearningPlan, type SaveData` from `./storage/save`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/QuestListScreen.test.tsx src/ui/ResultScreen.test.tsx src/App.test.tsx`
Expected: FAIL, cannot resolve `./QuestListScreen`.

- [ ] **Step 3: The Quest list screen**

Create `src/ui/QuestListScreen.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { Quest } from '../content/quest1';

interface QuestListScreenProps {
  quests: Quest[]; // open Quests only, in campaign order
  onPick: (quest: Quest) => void;
  onTitle: () => void;
}

/** The open Quests by name, newest focused. A plain list until the Map exists. */
export function QuestListScreen({ quests, onPick, onTitle }: QuestListScreenProps) {
  const newest = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    newest.current?.focus();
  }, []);
  return (
    <main className="screen quest">
      <h1>Quests</h1>
      <ol className="quest-list">
        {quests.map((q, i) => (
          <li key={q.id}>
            <button type="button" className="quest-row" ref={i === quests.length - 1 ? newest : undefined} onClick={() => onPick(q)}>
              <span className="quest-name">{q.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onTitle}>Title</button>
    </main>
  );
}
```

- [ ] **Step 4: The nudge**

In `src/ui/ResultScreen.tsx` import `levelUp, shouldNudgeLabels` from `'../game/play'` and render, after the Achievement lines:

```tsx
      {shouldNudgeLabels(encounter) && <p className="nudge" role="status">All your Work was right. Try the next fight with the labels hidden!</p>}
```

Add `.nudge { font-weight: 700; }` to `src/ui/styles.css`.

- [ ] **Step 5: Route by Quest in App**

In `src/App.tsx`:

- imports: add `QUESTS, type Quest` to the `./content/quest1` import; add `import { openQuests } from './game/quest';` and `import { QuestListScreen } from './ui/QuestListScreen';`
- add `Quests: 'quests'` to `Screen`
- add state: `const [quest, setQuest] = useState<Quest>(QUEST_1);`
- add a helper above `play`:

```tsx
  // The Quest a saved Encounter belongs to; a Survival fight belongs to none.
  const questOf = (e: Encounter): Quest | undefined => QUESTS.find((q) => q.id === e.spec.questId);
```

- replace `play`:

```tsx
  // Play resumes the open Encounter without re-beginning it, so a reload never loses a fight. Otherwise
  // it opens the only open Quest, or the Quest list once there is a choice.
  const play = (data: SaveData) => {
    if (data.activeEncounter) {
      setXpBefore(data.character.xp);
      setSaveBefore(data);
      setEncounter(data.activeEncounter);
      setQuest(questOf(data.activeEncounter) ?? QUEST_1);
      setScreen(Screen.Encounter);
      return;
    }
    const open = openQuests(data);
    if (open.length === 1) {
      setQuest(open[0]!);
      setScreen(Screen.Quest);
    } else {
      setScreen(Screen.Quests);
    }
  };
```

- add the case, and switch the Quest, Story and Closing cases from `QUEST_1` to `quest`:

```tsx
    case Screen.Quests:
      return <QuestListScreen quests={openQuests(save)} onPick={(q) => { setQuest(q); setScreen(Screen.Quest); }} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Quest:
      return <QuestScreen save={save} quest={quest} onPick={(i) => { setPick(quest.encounters[i]!); setScreen(Screen.Story); }} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Story:
      return <StoryPanelScreen quest={quest} encounter={pick} onFight={() => fight(save, pick)} />;
    case Screen.Closing:
      return <ClosingPanelScreen quest={quest} onTitle={() => setScreen(Screen.Title)} />;
```

- in the `Screen.Result` case derive everything from the finished Encounter's own Quest:

```tsx
      // The closing panel belongs to a won boss fight in its Quest: never a Retreat, never a Survival fight.
      const fought = questOf(encounter!);
      const boss = fought?.encounters[fought.encounters.length - 1];
      const bossWon = fought !== undefined && encounter!.status === EncounterStatus.Won && encounter!.spec.monsterId === boss!.monsterId;
```

  and use `onAgain={() => setScreen(bossWon ? Screen.Closing : fought ? Screen.Quest : Screen.Title)}`.

`Survival` keeps `survivalRoster(QUEST_1)`: Survival stays table-only.

An existing App test that completes Quest 1 and then presses Play now lands on the Quest list. Update it to press "The Fortress of Twelves" first; do not weaken what it asserts after that.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings && npm run build`
Expected: all pass and the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: Quest list, per-Quest routing, the hide-labels nudge, and a whole Quest 2 fight under test"
```

---

## Self-review notes

- Spec coverage: Tiers, Problems, any-order Work (Task 1); thresholds and plan (2); version 6 and recording (3); content, unlock, art check (4); selection, Review, cast, nudge rule (5); grid and keypad (6); labels, peek, waiting feedback, focus (7); Achievements (8); Quest list, routing, nudge line, integration (9). The glossary and the sixteen art prompts are written by the controller before Task 1, not by a task.
- One deliberate change from the spec: `QUESTS`, `findTemplate` and `SURVIVAL_QUEST_ID` stay in `quest1.ts`, which imports `quest2.ts` at runtime, and `quest2.ts` imports only types back. Moving them to a new `quests.ts` would touch 25 importers for no behaviour. The spec line is updated to match.
- `nextProblem` keeps its signature (32 call sites) and finds the Skill through `findTemplate`.
