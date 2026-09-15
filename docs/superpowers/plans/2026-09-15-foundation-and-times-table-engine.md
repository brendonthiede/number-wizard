# Foundation and Times-Table Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Vite/React/TypeScript skeleton plus the pure-logic learning engine for the multiplication table: Facts, mastery, spaced repetition, row introduction, Problem selection, and a save-data store.

**Architecture:** Everything in `src/engine/` is pure functions over plain data with no React, no I/O, and injectable clocks and RNG. `src/storage/` holds one save blob behind a two-method `Store` interface with an in-memory implementation for tests and an IndexedDB one for the browser. The UI is an untouched placeholder; combat, screens, Work skills, and the Guide loop are later plans.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Vitest (node environment), idb-keyval, GitHub Pages via Actions.

**Spec:** `docs/design.md` (rules and numbers), `CONTEXT.md` (vocabulary), `docs/adr/` (trade-offs).

## Global Constraints

- TDD is mandatory: failing test first, then code, every task.
- Use `CONTEXT.md` terms in identifiers and test names: Fact, Attempt, Mastered, Learning, Due, Encounter. Never "question", "card", "session".
- No commit trailers or attribution of any kind. Conventional-commit subjects (`feat:`, `chore:`, `test:`).
- Mastery: last three Attempts correct and each faster than the threshold (4000 ms for the times table). Any wrong or slow Attempt returns the Fact to Learning.
- Spaced repetition: Due 1, 3, 7, 14, 30 days after each correct Attempt once Mastered; reset on a Miss. Device local clock.
- Times-table Facts are commutative: 91 Facts for 0 to 12.
- Row order: 0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12. At most two rows open; a row is complete at 80% Mastered.
- Selection priority: explicit Problems → Due → Learning weighted toward recent Misses → one in five from Mastered. No repeats in an Encounter unless nothing else is available.
- Site base path is `/number-wizard/` (GitHub Pages project site).
- Keep the engine free of React and browser APIs so it runs under Vitest's node environment.

---

### Task 1: Scaffold, test runner, deploy workflow, art style guide

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/App.test.ts`
- Create: `.github/workflows/deploy.yml`
- Create: `docs/art-style.md`
- Modify: `CLAUDE.md` (replace the "Status" section with commands)

**Interfaces:**
- Produces: `npm test` (Vitest, single run), `npm run dev`, `npm run build`, `npm run typecheck`.

- [ ] **Step 1: Write the scaffold files**

`package.json`:
```json
{
  "name": "number-wizard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/number-wizard/',
  plugins: [react()],
  test: { environment: 'node' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Number Wizard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export const APP_TITLE = 'Number Wizard';

export function App() {
  return <h1>{APP_TITLE}</h1>;
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom idb-keyval
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest
```
Expected: `package-lock.json` created, no errors.

- [ ] **Step 3: Write a smoke test that proves the runner works**

`src/App.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { APP_TITLE } from './App';

describe('App', () => {
  it('has the game title', () => {
    expect(APP_TITLE).toBe('Number Wizard');
  });
});
```

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `npm test && npm run build`
Expected: 1 test passes; `dist/` is produced with assets under `/number-wizard/`.

- [ ] **Step 5: Write the deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: Write the art style guide**

`docs/art-style.md`:
```markdown
# Art style guide

Paste the **Base style** paragraph at the top of every image prompt, then the subject line for
the specific image. Revise this file after the first three images (a background, a monster, the
Character) come back.

## Base style

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette,
simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly
and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject.

## Specs

| Kind        | Aspect | Background                         | Notes                                   |
| ----------- | ------ | ---------------------------------- | --------------------------------------- |
| Background  | 16:9   | Full scene                         | No characters; leave the centre calm    |
| Monster     | 1:1    | Plain flat single colour (#F4EFE6) | Whole body visible, facing the viewer   |
| Character   | 1:1    | Plain flat single colour (#F4EFE6) | Wizard apprentice, waist up, holds staff|
| Loot        | 1:1    | Plain flat single colour (#F4EFE6) | One object, centred                     |

Images are displayed inside a framed panel, so plain backgrounds are fine and no cutout is needed.
Commit files as `public/art/<kind>/<slug>.png`.

## First three prompts

1. Background: "[Base style]. A wide view of a crumbling stone fortress on a hill at golden hour,
   twelve tall towers, banners with a spiral motif, a winding path leading up from a meadow."
2. Monster: "[Base style]. A goblin with nine eyes arranged in a triangle on its forehead, green
   skin, mischievous grin, holding a wooden club, full body, facing the viewer."
3. Character: "[Base style]. A young wizard apprentice with a slightly-too-big pointed blue hat,
   a star-tipped staff, a determined smile, waist up, facing the viewer."
```

- [ ] **Step 7: Replace the Status section of CLAUDE.md with commands**

Replace the whole `## Status` section (heading through the paragraph that ends "once they exist.") with:
```markdown
## Commands

```bash
npm install          # once
npm test             # all tests, single run (Vitest)
npm run test:watch   # watch mode
npx vitest run src/engine/mastery.test.ts          # one file
npx vitest run -t "returns to Learning"            # one test by name
npm run typecheck    # tsc, no emit
npm run dev          # Vite dev server
npm run build        # typecheck + production build to dist/
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`. Site base path is
`/number-wizard/`.
```

- [ ] **Step 8: Enable GitHub Pages for Actions deploys**

Run: `gh api --method POST repos/brendonthiede/number-wizard/pages -f build_type=workflow`
Expected: JSON with `"build_type": "workflow"`. If it returns 409 (already exists), that is fine.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite/React/Vitest, Pages deploy, design docs"
git push -u origin main
```

---

### Task 2: Times-table Facts and Problems

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/timesTable.ts`
- Test: `src/engine/timesTable.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type SkillId = 'times-table' | 'multi-digit-multiplication' | 'powers' | 'long-division';
  type FactId = string;
  interface Fact { id: FactId; skill: SkillId }
  interface TimesTableFact extends Fact { skill: 'times-table'; a: number; b: number } // a <= b
  interface Problem { factId: FactId; skill: SkillId; prompt: string; answer: number }
  interface Attempt { factId: FactId; answer: number | null; correct: boolean; durationMs: number; at: string; encounterId: string }
  type MasteryState = 'learning' | 'mastered';
  interface FactStatus { state: MasteryState; streak: number; dueAt: string | null }
  factId(a: number, b: number): FactId            // 'tt:3x4' for either order
  timesTableFacts(): TimesTableFact[]              // 91 facts
  timesTableProblem(fact: TimesTableFact, rng?: () => number): Problem
  ```

- [ ] **Step 1: Write the failing tests**

`src/engine/timesTable.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/timesTable.test.ts`
Expected: FAIL, cannot resolve `./timesTable`.

- [ ] **Step 3: Write the types and implementation**

`src/engine/types.ts`:
```ts
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

export interface Attempt {
  factId: FactId;
  answer: number | null;
  correct: boolean;
  durationMs: number;
  at: string; // ISO timestamp
  encounterId: string;
}

export type MasteryState = 'learning' | 'mastered';

export interface FactStatus {
  state: MasteryState;
  streak: number; // consecutive fast, correct Attempts
  dueAt: string | null; // ISO; only when mastered
}
```

`src/engine/timesTable.ts`:
```ts
import type { Problem, TimesTableFact } from './types';

export const factId = (a: number, b: number) => `tt:${Math.min(a, b)}x${Math.max(a, b)}`;

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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/timesTable.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/timesTable.ts src/engine/timesTable.test.ts
git commit -m "feat: times-table Facts and Problems"
```

---

### Task 3: Mastery and spaced repetition

**Files:**
- Create: `src/engine/mastery.ts`
- Test: `src/engine/mastery.test.ts`

**Interfaces:**
- Consumes: `Attempt`, `FactStatus`, `FactId` from `./types`.
- Produces:
  ```ts
  const TIMES_TABLE_THRESHOLD_MS = 4000;
  factStatus(attempts: Attempt[], thresholdMs: number): FactStatus   // attempts for ONE Fact, oldest first
  isDue(status: FactStatus, now: Date): boolean
  statusByFact(attempts: Attempt[], thresholdMs: number): Record<FactId, FactStatus>  // all attempts, any facts
  ```

- [ ] **Step 1: Write the failing tests**

`src/engine/mastery.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { factStatus, isDue, statusByFact, TIMES_TABLE_THRESHOLD_MS } from './mastery';
import type { Attempt } from './types';

const T0 = Date.parse('2026-09-15T12:00:00.000Z');
const DAY = 86_400_000;

const attempt = (i: number, over: Partial<Attempt> = {}): Attempt => ({
  factId: 'tt:3x4',
  answer: 12,
  correct: true,
  durationMs: 2000,
  at: new Date(T0 + i * 1000).toISOString(),
  encounterId: 'e1',
  ...over,
});

describe('factStatus', () => {
  it('is Learning with no Attempts', () => {
    expect(factStatus([], TIMES_TABLE_THRESHOLD_MS)).toEqual({ state: 'learning', streak: 0, dueAt: null });
  });

  it('is Mastered after three fast correct Attempts, Due one day later', () => {
    const s = factStatus([attempt(0), attempt(1), attempt(2)], TIMES_TABLE_THRESHOLD_MS);
    expect(s.state).toBe('mastered');
    expect(s.streak).toBe(3);
    expect(s.dueAt).toBe(new Date(T0 + 2000 + 1 * DAY).toISOString());
  });

  it('stretches the Due interval 1, 3, 7, 14, 30 days and caps at 30', () => {
    const days = (n: number) => {
      const s = factStatus(Array.from({ length: n }, (_, i) => attempt(i)), TIMES_TABLE_THRESHOLD_MS);
      return (Date.parse(s.dueAt!) - (T0 + (n - 1) * 1000)) / DAY;
    };
    expect([3, 4, 5, 6, 7, 8, 12].map(days)).toEqual([1, 3, 7, 14, 30, 30, 30]);
  });

  it('returns to Learning on a Miss', () => {
    const s = factStatus([attempt(0), attempt(1), attempt(2), attempt(3, { correct: false, answer: 11 })], TIMES_TABLE_THRESHOLD_MS);
    expect(s).toEqual({ state: 'learning', streak: 0, dueAt: null });
  });

  it('returns to Learning on a slow correct Attempt', () => {
    const s = factStatus([attempt(0), attempt(1), attempt(2), attempt(3, { durationMs: 4000 })], TIMES_TABLE_THRESHOLD_MS);
    expect(s.state).toBe('learning');
  });

  it('only counts the streak since the last Miss', () => {
    const s = factStatus([attempt(0, { correct: false }), attempt(1), attempt(2), attempt(3)], TIMES_TABLE_THRESHOLD_MS);
    expect(s).toMatchObject({ state: 'mastered', streak: 3 });
  });
});

describe('isDue', () => {
  it('is false for Learning Facts and future dates, true once the date arrives', () => {
    expect(isDue({ state: 'learning', streak: 0, dueAt: null }, new Date(T0))).toBe(false);
    const due = { state: 'mastered' as const, streak: 3, dueAt: new Date(T0 + DAY).toISOString() };
    expect(isDue(due, new Date(T0))).toBe(false);
    expect(isDue(due, new Date(T0 + DAY))).toBe(true);
  });
});

describe('statusByFact', () => {
  it('groups Attempts by Fact in order', () => {
    const attempts = [attempt(0), attempt(1, { factId: 'tt:5x5', answer: 25 }), attempt(2), attempt(3)];
    const s = statusByFact(attempts, TIMES_TABLE_THRESHOLD_MS);
    expect(s['tt:3x4']?.state).toBe('mastered');
    expect(s['tt:5x5']?.streak).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/mastery.test.ts`
Expected: FAIL, cannot resolve `./mastery`.

- [ ] **Step 3: Write the implementation**

`src/engine/mastery.ts`:
```ts
import type { Attempt, FactId, FactStatus } from './types';

export const TIMES_TABLE_THRESHOLD_MS = 4000;
const MASTERY_STREAK = 3;
const SCHEDULE_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 86_400_000;

/** `attempts` are for one Fact, oldest first. */
export function factStatus(attempts: Attempt[], thresholdMs: number): FactStatus {
  let streak = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i]!;
    if (!a.correct || a.durationMs >= thresholdMs) break;
    streak++;
  }
  if (streak < MASTERY_STREAK) return { state: 'learning', streak, dueAt: null };
  const last = attempts[attempts.length - 1]!;
  const days = SCHEDULE_DAYS[Math.min(streak - MASTERY_STREAK, SCHEDULE_DAYS.length - 1)]!;
  return { state: 'mastered', streak, dueAt: new Date(Date.parse(last.at) + days * DAY_MS).toISOString() };
}

export const isDue = (status: FactStatus, now: Date): boolean =>
  status.dueAt !== null && Date.parse(status.dueAt) <= now.getTime();

export function statusByFact(attempts: Attempt[], thresholdMs: number): Record<FactId, FactStatus> {
  const grouped: Record<FactId, Attempt[]> = {};
  for (const a of attempts) (grouped[a.factId] ??= []).push(a);
  return Object.fromEntries(Object.entries(grouped).map(([id, list]) => [id, factStatus(list, thresholdMs)]));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/mastery.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/mastery.ts src/engine/mastery.test.ts
git commit -m "feat: Fact mastery and spaced-repetition status"
```

---

### Task 4: Row introduction

**Files:**
- Create: `src/engine/rows.ts`
- Test: `src/engine/rows.test.ts`

**Interfaces:**
- Consumes: `factId` from `./timesTable`; `FactId`, `FactStatus`, `TimesTableFact` from `./types`.
- Produces:
  ```ts
  const ROW_ORDER: number[];                                  // [0,1,2,10,5,11,3,4,6,7,8,9,12]
  rowFactIds(n: number): FactId[];                            // the 13 Facts containing n
  openRows(status: Record<FactId, FactStatus>): number[];     // at most 2, in ROW_ORDER
  inRows(fact: TimesTableFact, rows: number[]): boolean;
  ```

- [ ] **Step 1: Write the failing tests**

`src/engine/rows.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { factId } from './timesTable';
import { inRows, openRows, ROW_ORDER, rowFactIds } from './rows';
import type { FactId, FactStatus } from './types';

const mastered: FactStatus = { state: 'mastered', streak: 3, dueAt: null };
const masteredRow = (n: number, count = 13): Record<FactId, FactStatus> =>
  Object.fromEntries(rowFactIds(n).slice(0, count).map((id) => [id, mastered]));

describe('rows', () => {
  it('introduces rows easy-first', () => {
    expect(ROW_ORDER).toEqual([0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12]);
  });

  it('a row is the 13 Facts containing that number', () => {
    expect(rowFactIds(3)).toHaveLength(13);
    expect(rowFactIds(3)).toContain(factId(3, 7));
    expect(rowFactIds(3)).toContain(factId(3, 3));
  });

  it('opens the first two rows with nothing Mastered', () => {
    expect(openRows({})).toEqual([0, 1]);
  });

  it('a row completes at 80% Mastered (11 of 13) and the next opens', () => {
    expect(openRows(masteredRow(0, 10))).toEqual([0, 1]);
    expect(openRows(masteredRow(0, 11))).toEqual([1, 2]);
  });

  it('opens nothing when every row is complete', () => {
    const all = Object.assign({}, ...ROW_ORDER.map((n) => masteredRow(n)));
    expect(openRows(all)).toEqual([]);
  });

  it('a Fact is in the open rows if either operand is', () => {
    const f = { id: factId(3, 7), skill: 'times-table' as const, a: 3, b: 7 };
    expect(inRows(f, [7, 8])).toBe(true);
    expect(inRows(f, [3, 8])).toBe(true);
    expect(inRows(f, [1, 2])).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/rows.test.ts`
Expected: FAIL, cannot resolve `./rows`.

- [ ] **Step 3: Write the implementation**

`src/engine/rows.ts`:
```ts
import { factId } from './timesTable';
import type { FactId, FactStatus, TimesTableFact } from './types';

export const ROW_ORDER = [0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12];
const MAX_OPEN = 2;
const COMPLETE_AT = Math.ceil(13 * 0.8); // 11 of 13

export const rowFactIds = (n: number): FactId[] => Array.from({ length: 13 }, (_, i) => factId(n, i));

export function openRows(status: Record<FactId, FactStatus>): number[] {
  const complete = (n: number) => rowFactIds(n).filter((id) => status[id]?.state === 'mastered').length >= COMPLETE_AT;
  return ROW_ORDER.filter((n) => !complete(n)).slice(0, MAX_OPEN);
}

export const inRows = (fact: TimesTableFact, rows: number[]): boolean =>
  rows.includes(fact.a) || rows.includes(fact.b);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/rows.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rows.ts src/engine/rows.test.ts
git commit -m "feat: easy-first row introduction for the times table"
```

---

### Task 5: Problem selection

**Files:**
- Create: `src/engine/select.ts`
- Test: `src/engine/select.test.ts`

**Interfaces:**
- Consumes: `isDue` from `./mastery`; `Attempt`, `Fact`, `FactId`, `FactStatus` from `./types`.
- Produces:
  ```ts
  interface Pools<F extends Fact> { due: F[]; learning: F[]; mastered: F[] }
  buildPools<F extends Fact>(facts: F[], status: Record<FactId, FactStatus>, eligible: (f: F) => boolean, now: Date): Pools<F>
  factWeight(attemptsForFact: Attempt[], emphasized: boolean): number   // 1 + Misses in last 5 + 2 if emphasized
  pickFact<F extends Fact>(pools: Pools<F>, weight: (f: F) => number, served: ReadonlySet<FactId>, rng?: () => number): F | null
  ```
- The Encounter loop (a later plan) serves the Learning Plan's explicit Problems first with `explicit.shift() ?? timesTableProblem(pickFact(...))`; that is where the "explicit → Due → Learning → Mastered" priority is completed.

- [ ] **Step 1: Write the failing tests**

`src/engine/select.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildPools, factWeight, pickFact } from './select';
import type { Attempt, Fact, FactId, FactStatus } from './types';

const T0 = Date.parse('2026-09-15T12:00:00.000Z');
const f = (id: string): Fact => ({ id, skill: 'times-table' });
const learning: FactStatus = { state: 'learning', streak: 0, dueAt: null };
const mastered = (dueOffsetMs: number): FactStatus => ({
  state: 'mastered', streak: 3, dueAt: new Date(T0 + dueOffsetMs).toISOString(),
});
const miss = (): Attempt => ({ factId: 'x', answer: 0, correct: false, durationMs: 1, at: '', encounterId: 'e' });
const hit = (): Attempt => ({ ...miss(), correct: true });

describe('buildPools', () => {
  it('splits Facts into Due, Learning (eligible only), and Mastered', () => {
    const facts = [f('due'), f('learn'), f('ineligible'), f('later'), f('new')];
    const status: Record<FactId, FactStatus> = {
      due: mastered(-1), learn: learning, ineligible: learning, later: mastered(+1),
    };
    const pools = buildPools(facts, status, (x) => x.id !== 'ineligible', new Date(T0));
    expect(pools.due.map((x) => x.id)).toEqual(['due']);
    expect(pools.learning.map((x) => x.id)).toEqual(['learn', 'new']);
    expect(pools.mastered.map((x) => x.id)).toEqual(['later']);
  });
});

describe('factWeight', () => {
  it('is 1 plus Misses in the last five Attempts, plus 2 when emphasized', () => {
    expect(factWeight([], false)).toBe(1);
    expect(factWeight([miss(), miss(), hit(), hit(), hit(), hit(), hit()], false)).toBe(1);
    expect(factWeight([hit(), miss(), miss(), hit(), hit()], false)).toBe(3);
    expect(factWeight([], true)).toBe(3);
  });
});

describe('pickFact', () => {
  const pools = { due: [f('d1')], learning: [f('l1'), f('l2')], mastered: [f('m1')] };
  const flat = () => 1;

  it('serves Due Facts first', () => {
    expect(pickFact(pools, flat, new Set(), () => 0.99)?.id).toBe('d1');
  });

  it('serves Learning Facts when nothing is Due, weighted', () => {
    const p = { ...pools, due: [] };
    const heavy = (x: Fact) => (x.id === 'l2' ? 100 : 1);
    expect(pickFact(p, heavy, new Set(), () => 0.5)?.id).toBe('l2');
  });

  it('serves a Mastered Fact one time in five', () => {
    const p = { ...pools, due: [] };
    expect(pickFact(p, flat, new Set(), () => 0.1)?.id).toBe('m1');
    expect(pickFact(p, flat, new Set(), () => 0.3)?.id).not.toBe('m1');
  });

  it('skips Facts already served this Encounter', () => {
    expect(pickFact(pools, flat, new Set(['d1']), () => 0.99)?.id).not.toBe('d1');
  });

  it('allows repeats only when everything has been served', () => {
    const served = new Set(['d1', 'l1', 'l2', 'm1']);
    expect(pickFact(pools, flat, served, () => 0.99)).not.toBeNull();
  });

  it('returns null with no Facts at all', () => {
    expect(pickFact({ due: [], learning: [], mastered: [] }, flat, new Set())).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/select.test.ts`
Expected: FAIL, cannot resolve `./select`.

- [ ] **Step 3: Write the implementation**

`src/engine/select.ts`:
```ts
import { isDue } from './mastery';
import type { Attempt, Fact, FactId, FactStatus } from './types';

export interface Pools<F extends Fact> {
  due: F[];
  learning: F[];
  mastered: F[];
}

const MASTERED_SHARE = 0.2; // one in five
const RECENT = 5;

export function buildPools<F extends Fact>(
  facts: F[],
  status: Record<FactId, FactStatus>,
  eligible: (f: F) => boolean,
  now: Date,
): Pools<F> {
  const pools: Pools<F> = { due: [], learning: [], mastered: [] };
  for (const f of facts) {
    const s = status[f.id];
    if (s?.state === 'mastered') (isDue(s, now) ? pools.due : pools.mastered).push(f);
    else if (eligible(f)) pools.learning.push(f);
  }
  return pools;
}

export function factWeight(attemptsForFact: Attempt[], emphasized: boolean): number {
  const misses = attemptsForFact.slice(-RECENT).filter((a) => !a.correct).length;
  return 1 + misses + (emphasized ? 2 : 0);
}

function weighted<F>(items: F[], weight: (f: F) => number, rng: () => number): F {
  const total = items.reduce((sum, f) => sum + weight(f), 0);
  let r = rng() * total;
  for (const f of items) {
    r -= weight(f);
    if (r < 0) return f;
  }
  return items[items.length - 1]!;
}

export function pickFact<F extends Fact>(
  pools: Pools<F>,
  weight: (f: F) => number,
  served: ReadonlySet<FactId>,
  rng: () => number = Math.random,
): F | null {
  const fresh = (fs: F[]) => fs.filter((f) => !served.has(f.id));
  const due = fresh(pools.due);
  if (due.length) return weighted(due, weight, rng);
  const learning = fresh(pools.learning);
  const mastered = fresh(pools.mastered);
  if (mastered.length && (!learning.length || rng() < MASTERED_SHARE)) return weighted(mastered, weight, rng);
  if (learning.length) return weighted(learning, weight, rng);
  const all = [...pools.due, ...pools.learning, ...pools.mastered]; // everything served: repeats allowed
  return all.length ? weighted(all, weight, rng) : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/select.test.ts`
Expected: 8 tests pass. Note the "one in five" test: with `rng` returning 0.1 the first call is the mastered roll (0.1 < 0.2), so `m1` is picked; with 0.3 it falls through to Learning.

- [ ] **Step 5: Commit**

```bash
git add src/engine/select.ts src/engine/select.test.ts
git commit -m "feat: Problem selection by Due, Learning, and Mastered pools"
```

---

### Task 6: Save data and Store

**Files:**
- Create: `src/storage/save.ts`
- Test: `src/storage/save.test.ts`

**Interfaces:**
- Consumes: `Attempt` from `../engine/types`; `get`, `set` from `idb-keyval`.
- Produces:
  ```ts
  interface SaveData { version: 1; playerId: string; attempts: Attempt[] }
  interface Store { load(): Promise<SaveData | undefined>; save(data: SaveData): Promise<void> }
  emptySave(playerId: string): SaveData
  withAttempt(data: SaveData, attempt: Attempt): SaveData      // pure, returns a new object
  memoryStore(): Store                                          // tests
  idbStore(key?: string): Store                                 // browser; default key 'number-wizard'
  ```
- Later plans extend `SaveData` with Character, achievements, and the Learning Plan; bump `version` and add a migration in `load` when they do.

- [ ] **Step 1: Write the failing tests**

`src/storage/save.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { emptySave, memoryStore, withAttempt } from './save';
import type { Attempt } from '../engine/types';

const attempt: Attempt = {
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500,
  at: '2026-09-15T12:00:00.000Z', encounterId: 'e1',
};

describe('save data', () => {
  it('starts empty for a Player', () => {
    expect(emptySave('noah')).toEqual({ version: 1, playerId: 'noah', attempts: [] });
  });

  it('appends an Attempt without mutating the original', () => {
    const before = emptySave('noah');
    const after = withAttempt(before, attempt);
    expect(after.attempts).toEqual([attempt]);
    expect(before.attempts).toEqual([]);
  });

  it('memoryStore round-trips and isolates its copy', async () => {
    const store = memoryStore();
    expect(await store.load()).toBeUndefined();
    const data = withAttempt(emptySave('noah'), attempt);
    await store.save(data);
    data.attempts.push(attempt);
    expect((await store.load())?.attempts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/storage/save.test.ts`
Expected: FAIL, cannot resolve `./save`.

- [ ] **Step 3: Write the implementation**

`src/storage/save.ts`:
```ts
import { get, set } from 'idb-keyval';
import type { Attempt } from '../engine/types';

export interface SaveData {
  version: 1;
  playerId: string;
  attempts: Attempt[];
}

export interface Store {
  load(): Promise<SaveData | undefined>;
  save(data: SaveData): Promise<void>;
}

export const emptySave = (playerId: string): SaveData => ({ version: 1, playerId, attempts: [] });

export const withAttempt = (data: SaveData, attempt: Attempt): SaveData => ({
  ...data,
  attempts: [...data.attempts, attempt],
});

export function memoryStore(): Store {
  let held: SaveData | undefined;
  return {
    load: async () => (held ? structuredClone(held) : undefined),
    save: async (data) => {
      held = structuredClone(data);
    },
  };
}

// Browser store: one blob in IndexedDB (ADR-0001). Untested glue; keep it this thin.
export function idbStore(key = 'number-wizard'): Store {
  return {
    load: () => get<SaveData>(key),
    save: (data) => set(key, data),
  };
}
```

- [ ] **Step 4: Run to verify it passes, then the whole suite and typecheck**

Run: `npx vitest run src/storage/save.test.ts && npm test && npm run typecheck`
Expected: 3 tests pass in the file; whole suite green (29 tests); typecheck clean.

- [ ] **Step 5: Commit and push**

```bash
git add src/storage/save.ts src/storage/save.test.ts
git commit -m "feat: save data with memory and IndexedDB stores"
git push
```

Then check the deploy: `gh run watch` until green, and `https://brendonthiede.github.io/number-wizard/` shows "Number Wizard".

---

## Out of scope for this plan (next plans)

1. **Encounter and combat**: monster HP, Hit/Critical/Glancing/Miss, Retreat, XP, Level, Titles, Loot, Achievements, Free Roam. Consumes `pickFact`, `buildPools`, `statusByFact`, `SaveData`.
2. **Screens**: Character creation, title, Encounter with keypad, Map, trophy case, Guide screen, PWA, Lexend, sound and music toggles.
3. **Work skills**: multi-digit multiplication and long division Work grids and checkers, powers, Tiers.
4. **Guide loop**: Export JSON and Learning Plan import (explicit Problems, emphasis, thresholds).
5. **Quest 1 content and art**.
