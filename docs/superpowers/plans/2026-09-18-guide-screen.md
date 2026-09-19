# Guide Screen and Learning Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Guide screen behind a gear on the title: Export the save, Import a Learning Plan or an Export, Reset; and a version-1 Learning Plan that changes the speed threshold, emphasis, monster HP, and serves explicit Problems.

**Architecture:** Three pure modules: `src/game/learningPlan.ts` (strict parser, then rule helpers over the save), `src/game/exportFile.ts` (Export builder and the import sniffer), and save data version 5 holding `{ plan, importedAt } | null`. `play.ts`, `achievements.ts`, and `QuestScreen` read the plan only through the helpers. `GuideScreen` takes its two side effects (download, copy) as props so tests inject fakes.

**Tech Stack:** React 19, TypeScript 7, Vitest 5 with jsdom and Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-18-guide-screen-design.md`. Rules: `docs/design.md` (Guide loop), `docs/adr/`. Vocabulary: `CONTEXT.md`.

## Global Constraints

- TDD is mandatory: failing test first, run it, then code, then run it. Paste RED and GREEN output in reports.
- CONTEXT.md terms: Guide, Player, Learning Plan, Export, Attempt, Fact, Encounter, Skill. Never "parent", "admin", "config", "backup", "dump", "user".
- No magic strings compared in production code: the two file kinds and the import result kinds are as-const objects. Docstrings on every export (CodeRabbit blocks below 80%). Comments state constraints.
- No commit trailers or attribution. Conventional subjects. Never `git push`.
- Component test files start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`.
- Exact values: file kinds `number-wizard-export` and `number-wizard-learning-plan`; plan `version` 1; threshold 1000 to 60000 ms; HP scale 0.5 to 3; at most 50 explicit Problems with operands 0 to 12; note at most 2000 characters; unknown keys rejected; default threshold 4000 ms (`TIMES_TABLE_THRESHOLD_MS`).
- The save blob is the only copy of the Player's history: a rejected import changes nothing; Reset and restore download an Export first.
- `src/game/` stays free of React and browser APIs.

---

### Task 1: Learning Plan parser

**Files:**
- Create: `src/game/learningPlan.ts`, `src/game/learningPlan.test.ts`

**Interfaces:**
- Consumes: `timesTableFacts` from `src/engine/timesTable.ts`; `SkillId`, `FactId` from `src/engine/types.ts`.
- Produces: `PLAN_KIND`, `interface LearningPlan { kind; version: 1; unlockedSkills?: SkillId[]; emphasize?: FactId[]; thresholds?: { 'times-table'?: number }; monsterHpScale?: number; problems?: [number, number][]; note?: string }`, `interface StoredPlan { plan: LearningPlan; importedAt: string }`, `parseLearningPlan(raw: unknown): LearningPlan`.

- [ ] **Step 1: Write the failing tests**

`src/game/learningPlan.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/learningPlan.test.ts`
Expected: FAIL, cannot resolve `./learningPlan`.

- [ ] **Step 3: Implement**

`src/game/learningPlan.ts`:
```ts
import { timesTableFacts } from '../engine/timesTable';
import type { FactId, SkillId } from '../engine/types';

/** The `kind` tag of a Learning Plan file. */
export const PLAN_KIND = 'number-wizard-learning-plan';

const SKILLS: SkillId[] = ['times-table', 'multi-digit-multiplication', 'powers', 'long-division'];
const TABLE_IDS = new Set(timesTableFacts().map((f) => f.id));
const KEYS = ['kind', 'version', 'unlockedSkills', 'emphasize', 'thresholds', 'monsterHpScale', 'problems', 'note'];
const LIMITS = { thresholdMin: 1000, thresholdMax: 60000, scaleMin: 0.5, scaleMax: 3, problems: 50, operandMax: 12, note: 2000 };

/** What the Guide imports: every field but `kind` and `version` is optional. It never contains story. */
export interface LearningPlan {
  kind: typeof PLAN_KIND;
  version: 1;
  unlockedSkills?: SkillId[];
  emphasize?: FactId[];
  thresholds?: { 'times-table'?: number };
  monsterHpScale?: number;
  problems?: [number, number][];
  note?: string;
}

/** A plan as the save holds it: explicit Problems are used up by Attempts made after `importedAt`. */
export interface StoredPlan {
  plan: LearningPlan;
  importedAt: string;
}

const fail = (field: string, why: string): never => { throw new Error(`Learning Plan: ${field} ${why}`); };
const inRange = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

/**
 * The trust boundary for a file the Guide pastes in: all-or-nothing, unknown keys rejected, and the
 * result is a fresh object holding only known fields.
 *
 * @throws {Error} naming the first field that is wrong, in plain words.
 */
export function parseLearningPlan(raw: unknown): LearningPlan {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Not a Learning Plan: expected a JSON object');
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(r)) if (!KEYS.includes(key)) fail(key, 'is not a known field');
  if (r.kind !== PLAN_KIND) fail('kind', `must be "${PLAN_KIND}"`);
  if (r.version !== 1) fail('version', 'must be 1');
  const plan: LearningPlan = { kind: PLAN_KIND, version: 1 };

  if (r.unlockedSkills !== undefined) {
    if (!Array.isArray(r.unlockedSkills) || !r.unlockedSkills.every((s) => SKILLS.includes(s as SkillId))) fail('unlockedSkills', 'must list known Skill ids');
    plan.unlockedSkills = [...(r.unlockedSkills as SkillId[])];
  }
  if (r.emphasize !== undefined) {
    if (!Array.isArray(r.emphasize) || !r.emphasize.every((id) => typeof id === 'string' && TABLE_IDS.has(id))) fail('emphasize', 'must list times-table Fact ids such as "tt:7x8"');
    plan.emphasize = [...(r.emphasize as FactId[])];
  }
  if (r.thresholds !== undefined) {
    const t = r.thresholds as Record<string, unknown> | null;
    if (typeof t !== 'object' || t === null || Array.isArray(t) || Object.keys(t).some((k) => k !== 'times-table')) fail('thresholds', 'may only set "times-table"');
    const ms = (t as Record<string, unknown>)['times-table'];
    if (ms !== undefined && !inRange(ms, LIMITS.thresholdMin, LIMITS.thresholdMax)) fail('thresholds', `times-table must be ${LIMITS.thresholdMin} to ${LIMITS.thresholdMax} ms`);
    plan.thresholds = ms === undefined ? {} : { 'times-table': ms as number };
  }
  if (r.monsterHpScale !== undefined) {
    if (!inRange(r.monsterHpScale, LIMITS.scaleMin, LIMITS.scaleMax)) fail('monsterHpScale', `must be ${LIMITS.scaleMin} to ${LIMITS.scaleMax}`);
    plan.monsterHpScale = r.monsterHpScale as number;
  }
  if (r.problems !== undefined) {
    const ok = Array.isArray(r.problems) && r.problems.length <= LIMITS.problems && r.problems.every((p) =>
      Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= LIMITS.operandMax));
    if (!ok) fail('problems', `must be at most ${LIMITS.problems} pairs of whole numbers 0 to ${LIMITS.operandMax}`);
    plan.problems = (r.problems as [number, number][]).map(([a, b]) => [a, b]);
  }
  if (r.note !== undefined) {
    if (typeof r.note !== 'string' || r.note.length > LIMITS.note) fail('note', `must be text of at most ${LIMITS.note} characters`);
    plan.note = r.note as string;
  }
  return plan;
}
```

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/game/learningPlan.test.ts && npm test && npm run typecheck`
Expected: 3 tests pass in the file; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/learningPlan.ts src/game/learningPlan.test.ts
git commit -m "feat: Learning Plan version 1 parser"
```

---

### Task 2: Save data version 5 and the Export file

**Files:**
- Modify: `src/storage/save.ts`, `src/storage/save.test.ts`
- Create: `src/game/exportFile.ts`, `src/game/exportFile.test.ts`

**Interfaces:**
- Consumes: `parseLearningPlan`, `PLAN_KIND`, `LearningPlan`, `StoredPlan` (Task 1); `migrate`, `SaveData`.
- Produces: `SaveData.version: 5`, `SaveData.learningPlan: StoredPlan | null`, `withLearningPlan(data, plan, now)`, `withoutLearningPlan(data)`; `EXPORT_KIND`, `ImportKind`, `buildExport(save, now)`, `exportFileName(save, now)`, `parseImport(text)`.

- [ ] **Step 1: Write the failing tests**

In `src/storage/save.test.ts`:
- Import `withLearningPlan, withoutLearningPlan` from `./save` and `PLAN_KIND` from `../game/learningPlan`.
- `starts empty for a Player`: expectation becomes `version: 5` with `learningPlan: null` added after `activeEncounter: null`.
- Rename `returns a version-4 save unchanged` to `returns a version-5 save unchanged`.
- In the v3 and v2 upgrade tests, expected `version: 4` becomes `version: 5` and the expected object gains `learningPlan: null`; in the v1 test `expect(data.version).toBe(4)` becomes `5` and add `expect(data.learningPlan).toBeNull();`.
- `Unsupported save version: 5` becomes version `6` in both the input and the message.
- Every corrupt-case assertion built from `emptySave('noah')` changes its message from `(version 4)` to `(version 5)`; `migrate({ version: 4 })` keeps `(version 4)` and add `expect(() => migrate({ version: 5 })).toThrow('Corrupt save data (version 5)');`.
- Add to `describe('migrate')`:
```ts
  it('upgrades a version-4 save with a null Learning Plan (invariant 8)', () => {
    const { learningPlan: _none, ...rest } = emptySave('noah');
    const v4 = { ...rest, version: 4 };
    expect(migrate(v4)).toEqual(emptySave('noah'));
  });

  it('rejects a save whose stored Learning Plan is malformed (invariant 8)', () => {
    const good = withLearningPlan(emptySave('noah'), { kind: PLAN_KIND, version: 1, monsterHpScale: 2 }, NOW);
    expect(migrate(good)).toEqual(good);
    expect(() => migrate({ ...good, learningPlan: { plan: { kind: PLAN_KIND, version: 1, monsterHpScale: 9 }, importedAt: NOW.toISOString() } })).toThrow('Corrupt save data (version 5)');
    expect(() => migrate({ ...good, learningPlan: { plan: good.learningPlan!.plan } })).toThrow('Corrupt save data (version 5)');
  });
```
- Add to `describe('save data')`:
```ts
  it('stores a Learning Plan with its import time, and removes it', () => {
    const plan = { kind: PLAN_KIND, version: 1 as const, note: 'hi' };
    const data = withLearningPlan(emptySave('noah'), plan, NOW);
    expect(data.learningPlan).toEqual({ plan, importedAt: NOW.toISOString() });
    expect(withoutLearningPlan(data).learningPlan).toBeNull();
    expect(emptySave('noah').learningPlan).toBeNull();
  });
```

`src/game/exportFile.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildExport, EXPORT_KIND, exportFileName, ImportKind, parseImport } from './exportFile';
import { PLAN_KIND } from './learningPlan';
import { beginEncounter, cast, nextProblem } from './play';
import { QUEST_1 } from '../content/quest1';
import { emptySave, withCharacter, withLearningPlan } from '../storage/save';

const NOW = new Date('2026-09-18T15:04:05.000Z');
const played = () => {
  let { save, encounter } = beginEncounter(withCharacter(emptySave('noah'), 'Noah', 'character-02'), QUEST_1.encounters[0]!, NOW, 'e1');
  const p = nextProblem(save, encounter, NOW, () => 0.5);
  ({ save } = cast(save, encounter, QUEST_1.encounters[0]!, p, p.answer, 1000, NOW, () => 0.5));
  return withLearningPlan(save, { kind: PLAN_KIND, version: 1, note: 'n' }, NOW);
};

describe('Export', () => {
  it('wraps the whole save with a kind and a time, named for the Player and the day', () => {
    const save = played();
    expect(buildExport(save, NOW)).toEqual({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save });
    expect(EXPORT_KIND).toBe('number-wizard-export');
    expect(exportFileName(save, NOW)).toBe('number-wizard-noah-2026-09-18.json');
  });

  it('round-trips through parseImport to an equal save (invariant 2)', () => {
    const save = played();
    expect(parseImport(JSON.stringify(buildExport(save, NOW)))).toEqual({ kind: ImportKind.Save, save });
  });
});

describe('parseImport', () => {
  it('recognises a Learning Plan', () => {
    const plan = { kind: PLAN_KIND, version: 1, monsterHpScale: 2 };
    expect(parseImport(JSON.stringify(plan))).toEqual({ kind: ImportKind.Plan, plan });
  });

  it('rejects anything else in plain words and never returns a partial result', () => {
    expect(() => parseImport('not json')).toThrow('That is not valid JSON.');
    expect(() => parseImport('{"kind":"mystery"}')).toThrow('That is neither a Learning Plan nor an Export.');
    expect(() => parseImport(JSON.stringify({ kind: EXPORT_KIND, save: { version: 99 } }))).toThrow('Unsupported save version: 99');
    expect(() => parseImport(JSON.stringify({ kind: PLAN_KIND, version: 1, monsterHpScale: 9 }))).toThrow('monsterHpScale');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/storage/save.test.ts src/game/exportFile.test.ts`
Expected: FAIL, missing exports and version mismatches.

- [ ] **Step 3: Implement**

In `src/storage/save.ts`:
- Add `import { parseLearningPlan, type LearningPlan, type StoredPlan } from '../game/learningPlan';` (`learningPlan.ts` imports nothing from storage, so there is no cycle).
- `SaveData`: `version: 5;` and a new last field `learningPlan: StoredPlan | null;`.
- Add `interface SaveV4 extends Omit<SaveData, 'version' | 'learningPlan'> { version: 4 }`; `SaveV2` and `SaveV3` change their `Omit` to `'version' | 'character' | 'learningPlan'`.
- Add above `migrate`:
```ts
// A stored plan passes the same parser as an imported one; anything else is a corrupt save.
function isStoredPlan(value: unknown): value is StoredPlan {
  const s = value as Partial<StoredPlan> | null;
  if (typeof s !== 'object' || s === null || typeof s.importedAt !== 'string' || Number.isNaN(Date.parse(s.importedAt))) return false;
  try { parseLearningPlan(s.plan); return true; } catch { return false; }
}
```
- In `migrate`: the current `version === 4` branch becomes `version === 5` with `&& (data.learningPlan === null || isStoredPlan(data.learningPlan))` added to `valid` and the message `(version 5)`. Add a new `version === 4` branch with the old version-4 validity checks (on `old` typed `Partial<SaveV4>`) that throws `Corrupt save data (version 4)` or returns `migrate({ ...old, version: 5, learningPlan: null })`. The version-3 branch keeps returning `migrate({ ...old, version: 4, ... })`. Update the docstring to "version 1-4".
- `emptySave`: `version: 5` and `learningPlan: null`.
- Add:
```ts
/** Stores an imported Learning Plan; explicit Problems count as used up only by Attempts after `now`. */
export const withLearningPlan = (data: SaveData, plan: LearningPlan, now: Date): SaveData => ({
  ...data,
  learningPlan: { plan, importedAt: now.toISOString() },
});

/** Removes the Learning Plan, returning every rule to its default. */
export const withoutLearningPlan = (data: SaveData): SaveData => ({ ...data, learningPlan: null });
```

`src/game/exportFile.ts`:
```ts
import { migrate, type SaveData } from '../storage/save';
import { parseLearningPlan, PLAN_KIND, type LearningPlan } from './learningPlan';

/** The `kind` tag of an Export file. */
export const EXPORT_KIND = 'number-wizard-export';

/** What an imported file turned out to be. */
export const ImportKind = { Plan: 'plan', Save: 'save' } as const;
export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind];

/** The Guide's raw material: the whole save, tagged and timestamped. */
export interface ExportFile {
  kind: typeof EXPORT_KIND;
  exportedAt: string;
  save: SaveData;
}

/** Wraps the save for download; nothing is summarised or dropped. */
export const buildExport = (save: SaveData, now: Date): ExportFile => ({ kind: EXPORT_KIND, exportedAt: now.toISOString(), save });

/** `number-wizard-<playerId>-<YYYY-MM-DD>.json`, dated in UTC. */
export const exportFileName = (save: SaveData, now: Date): string => `number-wizard-${save.playerId}-${now.toISOString().slice(0, 10)}.json`;

/**
 * Sniffs pasted text: a Learning Plan is parsed strictly, an Export's save goes through `migrate`.
 *
 * @throws {Error} with a plain message; never returns a partial result.
 */
export function parseImport(text: string): { kind: typeof ImportKind.Plan; plan: LearningPlan } | { kind: typeof ImportKind.Save; save: SaveData } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('That is not valid JSON.'); }
  const kind = (raw as { kind?: unknown } | null)?.kind;
  if (kind === PLAN_KIND) return { kind: ImportKind.Plan, plan: parseLearningPlan(raw) };
  if (kind === EXPORT_KIND) return { kind: ImportKind.Save, save: migrate((raw as { save?: unknown }).save) };
  throw new Error('That is neither a Learning Plan nor an Export.');
}
```

- [ ] **Step 4: Fix other fixtures the type change breaks, then run everything**

Run `npm run typecheck`; any test fixture that builds a `SaveData` literal without `learningPlan` gets `learningPlan: null` (spread from `emptySave` wherever possible). Then:
Run: `npx vitest run src/storage/save.test.ts src/game/exportFile.test.ts && npm test && npm run typecheck`
Expected: all pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: save data v5 with a stored Learning Plan; Export file and import sniffing"
```

---

### Task 3: The Learning Plan's rules in play

**Files:**
- Modify: `src/game/learningPlan.ts`, `src/game/learningPlan.test.ts`, `src/game/play.ts`, `src/game/play.test.ts`, `src/game/achievements.ts`, `src/game/achievements.test.ts`, `src/ui/QuestScreen.tsx`, `src/ui/QuestScreen.test.tsx`

**Interfaces:**
- Consumes: `SaveData`, `withLearningPlan` (Task 2); `TIMES_TABLE_THRESHOLD_MS`; `factId` from `timesTable.ts`.
- Produces in `learningPlan.ts`: `thresholdFor(save): number`, `achievementThresholdFor(save): number`, `scaledHp(save, hp): number`, `isEmphasized(save, factId): boolean`, `nextExplicitProblem(save, served: ReadonlySet<FactId>): Problem | null`, `remainingExplicit(save): number`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game/learningPlan.test.ts` (imports: the six helpers; `emptySave, withAttempt, withCharacter, withLearningPlan` from `../storage/save`; `Outcome, type Attempt` from `../engine/types`):
```ts
const T0 = Date.parse('2026-09-18T12:00:00.000Z');
const base = () => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const planned = (plan: object) => withLearningPlan(base(), { kind: PLAN_KIND, version: 1, ...plan } as never, new Date(T0));
const attempt = (factId: string, offsetMs: number): Attempt => ({ factId, answer: 0, correct: true, durationMs: 1500, at: new Date(T0 + offsetMs).toISOString(), encounterId: 'e', outcome: Outcome.Critical });

describe('plan rules', () => {
  it('fall back to the defaults without a plan', () => {
    expect(thresholdFor(base())).toBe(4000);
    expect(achievementThresholdFor(base())).toBe(4000);
    expect(scaledHp(base(), 6)).toBe(6);
    expect(isEmphasized(base(), 'tt:7x8')).toBe(false);
    expect(nextExplicitProblem(base(), new Set())).toBeNull();
    expect(remainingExplicit(base())).toBe(0);
  });

  it('threshold follows the plan; Achievements take the more lenient of the two', () => {
    expect(thresholdFor(planned({ thresholds: { 'times-table': 6000 } }))).toBe(6000);
    expect(achievementThresholdFor(planned({ thresholds: { 'times-table': 6000 } }))).toBe(6000);
    expect(thresholdFor(planned({ thresholds: { 'times-table': 2000 } }))).toBe(2000);
    expect(achievementThresholdFor(planned({ thresholds: { 'times-table': 2000 } }))).toBe(4000);
  });

  it('scaledHp rounds and never goes below 1 (invariant 6)', () => {
    expect(scaledHp(planned({ monsterHpScale: 1.5 }), 7)).toBe(11);
    expect(scaledHp(planned({ monsterHpScale: 0.5 }), 1)).toBe(1);
    expect(scaledHp(planned({ monsterHpScale: 3 }), 15)).toBe(45);
  });

  it('serves explicit Problems in order, each once, counting only Attempts after the import (invariant 5)', () => {
    let save = planned({ problems: [[7, 8], [6, 9], [8, 7]] });
    save = withAttempt(save, attempt('tt:7x8', -1000)); // before the import: does not count
    expect(remainingExplicit(save)).toBe(3);
    expect(nextExplicitProblem(save, new Set())).toEqual({ factId: 'tt:7x8', skill: 'times-table', prompt: '7 × 8', answer: 56 });
    expect(nextExplicitProblem(save, new Set(['tt:7x8']))!.prompt).toBe('6 × 9'); // blocked by the no-repeat rule, the next one goes
    save = withAttempt(save, attempt('tt:7x8', 1000));
    expect(nextExplicitProblem(save, new Set())!.prompt).toBe('6 × 9');
    save = withAttempt(save, attempt('tt:6x9', 2000));
    expect(nextExplicitProblem(save, new Set())!.prompt).toBe('8 × 7'); // same Fact as 7 × 8, needs a second Attempt
    save = withAttempt(save, attempt('tt:7x8', 3000));
    expect(nextExplicitProblem(save, new Set())).toBeNull();
    expect(remainingExplicit(save)).toBe(0);
  });

  it('marks emphasised Facts', () => {
    expect(isEmphasized(planned({ emphasize: ['tt:7x8'] }), 'tt:7x8')).toBe(true);
    expect(isEmphasized(planned({ emphasize: ['tt:7x8'] }), 'tt:6x9')).toBe(false);
  });
});
```

Add to `src/game/play.test.ts` (imports: `withLearningPlan` from `../storage/save`, `PLAN_KIND` from `./learningPlan`):
```ts
describe('Learning Plan in play', () => {
  const plan = (p: object) => withLearningPlan(withXp(0), { kind: PLAN_KIND, version: 1, ...p } as never, NOW);

  it('a 5000 ms correct answer is a Critical Hit and counts toward mastery only under a 6000 ms plan (invariant 3)', () => {
    for (const [save, expected] of [[withXp(0), Outcome.Hit], [plan({ thresholds: { 'times-table': 6000 } }), Outcome.Critical]] as const) {
      const begun = beginEncounter(save, QUEST_1_FIRST, NOW, 'e1');
      const p = nextProblem(begun.save, begun.encounter, NOW, rng);
      const r = cast(begun.save, begun.encounter, QUEST_1_FIRST, p, p.answer, 5000, NOW, rng);
      expect(r.outcome).toBe(expected);
      const status = statusByFact(r.save.attempts, thresholdFor(r.save), masteryStreakFor)[p.factId]!;
      expect(status.streak).toBe(expected === Outcome.Critical ? 1 : 0);
    }
  });

  it('scales monster HP at the start, and XP follows the scaled HP (invariant 6)', () => {
    let { save, encounter } = beginEncounter(plan({ monsterHpScale: 0.5 }), QUEST_1_FIRST, NOW, 'e1');
    expect(encounter.spec.monsterMaxHp).toBe(3);
    while (encounter.status === EncounterStatus.Active) {
      const p = nextProblem(save, encounter, NOW, rng);
      ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, rng));
    }
    expect(save.character.xp).toBe(6);
  });

  it('serves explicit Problems first and in order, then selects as before (invariant 5)', () => {
    let { save, encounter } = beginEncounter(plan({ problems: [[12, 12], [9, 7]] }), QUEST_1_FIRST, NOW, 'e1');
    const later = new Date(NOW.getTime() + 1000);
    const first = nextProblem(save, encounter, later, rng);
    expect(first.prompt).toBe('12 × 12');
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, first, 1, 1000, later, rng)); // a Miss still uses it up
    const second = nextProblem(save, encounter, later, rng);
    expect(second.prompt).toBe('9 × 7');
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, second, 63, 1000, later, rng));
    const third = nextProblem(save, encounter, later, rng);
    const [a, b] = third.prompt.split(' × ').map(Number);
    expect(a! <= 1 || b! <= 1).toBe(true); // back to the introduced rows
  });

  it('weights emphasised Facts through factWeight', () => {
    const save = plan({ emphasize: ['tt:0x0'] });
    const { encounter } = beginEncounter(save, QUEST_1_FIRST, NOW, 'e1');
    let zeroZero = 0;
    for (let i = 0; i < 400; i++) if (nextProblem(save, encounter, NOW, rng).factId === 'tt:0x0') zeroZero++;
    expect(zeroZero).toBeGreaterThan(400 / 25 * 2); // 25 eligible Facts; weight 3 against 1 is well over double the even share
  });
});
```
(also import `thresholdFor` from `./learningPlan` and `Outcome` from `../engine/types` if not already imported.)

Add to `src/game/achievements.test.ts` (imports: `withLearningPlan` from `../storage/save`, `PLAN_KIND` from `./learningPlan`):
```ts
  it('a stricter plan never un-earns an Achievement; a looser one helps (invariant 4)', () => {
    const rowZero = Array.from({ length: 11 }, (_, i) => attempt(i, { factId: factId(0, i), durationMs: 3000 }));
    const save = { ...base(), attempts: rowZero };
    const strict = withLearningPlan(save, { kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 2000 } }, new Date(T0));
    expect(earnedIds(strict)).toEqual(earnedIds(save));
    expect(byId(strict, 'row-0').earnedAt).not.toBeNull();
    const slow = { ...base(), attempts: rowZero.map((a) => ({ ...a, durationMs: 5000 })) };
    expect(byId(slow, 'row-0').earnedAt).toBeNull();
    const loose = withLearningPlan(slow, { kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 6000 } }, new Date(T0));
    expect(byId(loose, 'row-0').earnedAt).not.toBeNull();
  });
```

Add to `src/ui/QuestScreen.test.tsx` (imports: `withLearningPlan`, `PLAN_KIND`):
```tsx
  it('shows monster HP as the Learning Plan scales it', () => {
    const save = withLearningPlan(base(), { kind: PLAN_KIND, version: 1, monsterHpScale: 2 }, new Date());
    render(<QuestScreen save={save} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} />);
    expect(screen.getByLabelText('30 of 30 monster hit points')).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/learningPlan.test.ts src/game/play.test.ts src/game/achievements.test.ts src/ui/QuestScreen.test.tsx`
Expected: FAIL, helpers not exported; outcomes and HP unchanged by the plan.

- [ ] **Step 3: Implement**

Append to `src/game/learningPlan.ts` (new imports: `TIMES_TABLE_THRESHOLD_MS` from `../engine/mastery`, `factId` from `../engine/timesTable`, `type Problem` from `../engine/types`, `type SaveData` from `../storage/save` as a type-only import):
```ts
const SKILL = 'times-table';

/** The speed threshold in force: the plan's, or 4000 ms. Drives Critical Hits, mastery, and Due dates. */
export const thresholdFor = (save: SaveData): number => save.learningPlan?.plan.thresholds?.[SKILL] ?? TIMES_TABLE_THRESHOLD_MS;

/** Achievements use the more lenient of the default and the plan, so a stricter plan never takes one away. */
export const achievementThresholdFor = (save: SaveData): number => Math.max(TIMES_TABLE_THRESHOLD_MS, thresholdFor(save));

/** Monster HP under the plan's scale: rounded, never below 1. */
export const scaledHp = (save: SaveData, hp: number): number => Math.max(1, Math.round(hp * (save.learningPlan?.plan.monsterHpScale ?? 1)));

/** Whether the plan asks for extra weight on this Fact. */
export const isEmphasized = (save: SaveData, id: FactId): boolean => save.learningPlan?.plan.emphasize?.includes(id) ?? false;

// An entry is used up by one Attempt on its Fact made after the import; the k-th repeat needs k.
function pendingExplicit(save: SaveData): [number, number][] {
  const stored = save.learningPlan;
  if (!stored?.plan.problems) return [];
  const since = Date.parse(stored.importedAt);
  const budget: Record<FactId, number> = {};
  for (const a of save.attempts) if (Date.parse(a.at) > since) budget[a.factId] = (budget[a.factId] ?? 0) + 1;
  return stored.plan.problems.filter(([a, b]) => {
    const id = factId(a, b);
    if ((budget[id] ?? 0) > 0) { budget[id]!--; return false; }
    return true;
  });
}

/** How many explicit Problems the plan still has to serve. */
export const remainingExplicit = (save: SaveData): number => pendingExplicit(save).length;

/** The next explicit Problem, in the plan's operand order, skipping Facts already served this Encounter. */
export function nextExplicitProblem(save: SaveData, served: ReadonlySet<FactId>): Problem | null {
  const next = pendingExplicit(save).find(([a, b]) => !served.has(factId(a, b)));
  if (!next) return null;
  const [a, b] = next;
  return { factId: factId(a, b), skill: SKILL, prompt: `${a} × ${b}`, answer: a * b };
}
```

`src/game/play.ts`:
- Import `isEmphasized, nextExplicitProblem, scaledHp, thresholdFor` from `./learningPlan`; drop the `TIMES_TABLE_THRESHOLD_MS` import.
- `beginEncounter`: `monsterMaxHp: scaledHp(save, template.monsterMaxHp)`.
- `nextProblem`: first lines become
```ts
  const served = servedFacts(encounter);
  const explicit = nextExplicitProblem(save, served);
  if (explicit) return explicit;
  const status = statusByFact(save.attempts, thresholdFor(save), masteryStreakFor);
```
  and the `pickFact` call uses `factWeight(byFact[f.id] ?? [], isEmphasized(save, f.id))` and `served`.
- `cast`: `castSpell(..., thresholdFor(save), now)`.

`src/game/achievements.ts`: import `achievementThresholdFor` from `./learningPlan`; compute `const threshold = achievementThresholdFor(save);` once at the top of `achievements` and pass it to `factStatus` in place of `TIMES_TABLE_THRESHOLD_MS`; drop that import if unused.

`src/ui/QuestScreen.tsx`: import `scaledHp` from `../game/learningPlan`; the pips use `const hp = scaledHp(save, e.monsterMaxHp);` for both `hp` and `maxHp`.

- [ ] **Step 4: Run the files, the suite, typecheck**

Run: `npx vitest run src/game/learningPlan.test.ts src/game/play.test.ts src/game/achievements.test.ts src/ui/QuestScreen.test.tsx && npm test && npm run typecheck`
Expected: all pass; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: the Learning Plan drives the threshold, emphasis, monster HP, and explicit Problems"
```

---

### Task 4: Guide screen and App wiring

**Files:**
- Create: `src/ui/GuideScreen.tsx`, `src/ui/GuideScreen.test.tsx`
- Modify: `src/ui/TitleScreen.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `buildExport`, `exportFileName`, `parseImport`, `ImportKind` (Task 2); `withLearningPlan`, `withoutLearningPlan`; `thresholdFor`, `scaledHp`, `remainingExplicit` (Task 3); `emptySave`, `PLAYER_ID`.
- Produces: `GuideScreen({ save, onSave, onReset, onTitle, now?, download?, copy? })`; `TitleScreen` prop `onGuide`; `Screen.Guide`.

- [ ] **Step 1: Write the failing tests**

`src/ui/GuideScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuideScreen } from './GuideScreen';
import { buildExport, EXPORT_KIND } from '../game/exportFile';
import { PLAN_KIND } from '../game/learningPlan';
import { emptySave, withCharacter, withLearningPlan, type SaveData } from '../storage/save';

afterEach(cleanup);

const NOW = new Date('2026-09-18T15:04:05.000Z');
const base = (): SaveData => ({ ...withCharacter(emptySave('noah'), 'Noah', 'character-01'), character: { name: 'Noah', portrait: 'character-01', xp: 40, survivalBest: 2 } });

function mount(save = base()) {
  const props = { onSave: vi.fn(), onReset: vi.fn(), onTitle: vi.fn(), download: vi.fn(), copy: vi.fn(async () => {}) };
  render(<GuideScreen save={save} now={() => NOW} {...props} />);
  return props;
}
const paste = (text: string) => fireEvent.change(screen.getByLabelText('Paste a Learning Plan or an Export'), { target: { value: text } });

describe('GuideScreen', () => {
  it('downloads the Export, or copies it', async () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Download Export' }));
    expect(p.download).toHaveBeenCalledWith('number-wizard-noah-2026-09-18.json', JSON.stringify(buildExport(base(), NOW), null, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Export' }));
    expect(p.copy).toHaveBeenCalledWith(JSON.stringify(buildExport(base(), NOW), null, 2));
    expect(await screen.findByText('Export copied.')).toBeTruthy();
  });

  it('imports a Learning Plan at once and shows its summary', () => {
    const p = mount();
    expect(screen.getByText('No Learning Plan.')).toBeTruthy();
    paste(JSON.stringify({ kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 6000 }, monsterHpScale: 1.5, problems: [[7, 8]], note: 'slow and steady' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByText('Learning Plan imported.')).toBeTruthy();
    const saved = p.onSave.mock.calls[0]![0] as SaveData;
    expect(saved.learningPlan).toEqual({ plan: expect.objectContaining({ monsterHpScale: 1.5 }), importedAt: NOW.toISOString() });
  });

  it('shows the current plan and removes it', () => {
    const p = mount(withLearningPlan(base(), { kind: PLAN_KIND, version: 1, thresholds: { 'times-table': 6000 }, monsterHpScale: 1.5, problems: [[7, 8]], emphasize: ['tt:7x8'], note: 'slow and steady' }, NOW));
    expect(screen.getByText(/6000 ms/)).toBeTruthy();
    expect(screen.getByText(/1\.5/)).toBeTruthy();
    expect(screen.getByText(/1 emphasised/)).toBeTruthy();
    expect(screen.getByText(/1 explicit Problem left/)).toBeTruthy();
    expect(screen.getByText('slow and steady')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Learning Plan' }));
    expect((p.onSave.mock.calls[0]![0] as SaveData).learningPlan).toBeNull();
  });

  it('rejects a bad file in plain words and changes nothing (invariant 1)', () => {
    const p = mount();
    paste('{"kind":"number-wizard-learning-plan","version":1,"monsterHpScale":9}');
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('alert').textContent).toContain('monsterHpScale');
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('restores an Export only after confirming, and downloads the current save first', () => {
    const p = mount();
    const other = { ...base(), character: { ...base().character, xp: 999 } };
    paste(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: other }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(p.onSave).not.toHaveBeenCalled();
    expect(screen.getByText("This replaces all of Noah's progress.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace progress' }));
    expect(p.download).toHaveBeenCalledTimes(1);
    expect(p.download.mock.invocationCallOrder[0]!).toBeLessThan(p.onSave.mock.invocationCallOrder[0]!);
    expect(p.onSave).toHaveBeenCalledWith(other);
    expect(screen.getByText('Save restored.')).toBeTruthy();
  });

  it('Reset downloads before clearing, and Cancel changes nothing (invariant 7)', () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText("This deletes all of Noah's progress.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.download).not.toHaveBeenCalled();
    expect(p.onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete progress' }));
    expect(p.download.mock.invocationCallOrder[0]!).toBeLessThan(p.onReset.mock.invocationCallOrder[0]!);
    expect(p.onReset).toHaveBeenCalledTimes(1);
  });
});
```

Add to `src/App.test.tsx`:
```tsx
  it('the gear opens the Guide screen; Reset clears to Character creation after a confirmation', async () => {
    const store = memoryStore();
    await store.save({ ...named(), character: { ...named().character, xp: 40 } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createUrl = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }));
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guide' }));
    expect(screen.getByRole('heading', { name: 'Guide' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete progress' }));
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Who are you?')).toBeTruthy();
    expect((await store.load())?.character).toEqual(emptySave('noah').character);
    click.mockRestore();
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/GuideScreen.test.tsx src/App.test.tsx`
Expected: FAIL, cannot resolve `./GuideScreen`; no "Guide" button.

- [ ] **Step 3: Implement**

`src/ui/GuideScreen.tsx`:
```tsx
import { useState, type ChangeEvent } from 'react';
import { buildExport, exportFileName, ImportKind, parseImport } from '../game/exportFile';
import { remainingExplicit, scaledHp, thresholdFor } from '../game/learningPlan';
import { withLearningPlan, withoutLearningPlan, type SaveData } from '../storage/save';

interface GuideScreenProps {
  save: SaveData;
  onSave: (save: SaveData) => void;
  onReset: () => void;
  onTitle: () => void;
  now?: () => Date;
  download?: (fileName: string, text: string) => void;
  copy?: (text: string) => Promise<void>;
}

const Pending = { Reset: 'reset', Restore: 'restore' } as const;
type Pending = { kind: typeof Pending.Reset } | { kind: typeof Pending.Restore; save: SaveData };

const browserDownload = (fileName: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * The Guide's screen: Export, Import of a Learning Plan or an Export, and Reset. The save is the
 * only copy of the Player's history, so anything that replaces it downloads an Export first.
 */
export function GuideScreen({ save, onSave, onReset, onTitle, now = () => new Date(), download = browserDownload, copy = (t) => navigator.clipboard.writeText(t) }: GuideScreenProps) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);

  const exportText = () => JSON.stringify(buildExport(save, now()), null, 2);
  const downloadExport = () => download(exportFileName(save, now()), exportText());
  const say = (message: string) => { setStatus(message); setError(''); };

  const doImport = () => {
    try {
      const parsed = parseImport(text);
      if (parsed.kind === ImportKind.Plan) {
        onSave(withLearningPlan(save, parsed.plan, now()));
        setText('');
        say('Learning Plan imported.');
      } else {
        setPending({ kind: Pending.Restore, save: parsed.save });
      }
    } catch (err) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirm = () => {
    if (!pending) return;
    downloadExport();
    if (pending.kind === Pending.Reset) onReset();
    else { onSave(pending.save); setText(''); say('Save restored.'); }
    setPending(null);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  };

  const stored = save.learningPlan;
  const left = remainingExplicit(save);

  if (pending) {
    const reset = pending.kind === Pending.Reset;
    return (
      <main className="screen guide">
        <h1>Guide</h1>
        <p>{reset ? `This deletes all of ${save.character.name}'s progress.` : `This replaces all of ${save.character.name}'s progress.`}</p>
        <p>An Export of the current progress downloads first.</p>
        <button type="button" className="primary" onClick={() => setPending(null)} autoFocus>Cancel</button>
        <button type="button" onClick={confirm}>{reset ? 'Delete progress' : 'Replace progress'}</button>
      </main>
    );
  }

  return (
    <main className="screen guide">
      <h1>Guide</h1>
      <section>
        <h2>Export</h2>
        <button type="button" onClick={() => { downloadExport(); say('Export downloaded.'); }}>Download Export</button>
        <button type="button" onClick={() => { copy(exportText()).then(() => say('Export copied.')).catch(() => setError('Copy failed. Use Download Export.')); }}>Copy Export</button>
      </section>
      <section>
        <h2>Import</h2>
        <label htmlFor="guide-import">Paste a Learning Plan or an Export</label>
        <textarea id="guide-import" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        <input type="file" accept="application/json,.json" aria-label="Choose file" onChange={onFile} />
        <button type="button" onClick={doImport} disabled={!text.trim()}>Import</button>
      </section>
      <section>
        <h2>Learning Plan</h2>
        {stored ? (
          <>
            <p>Threshold {thresholdFor(save)} ms. Monster HP scale {stored.plan.monsterHpScale ?? 1} (a 6 HP monster has {scaledHp(save, 6)}).</p>
            <p>{stored.plan.emphasize?.length ?? 0} emphasised. {left} explicit {left === 1 ? 'Problem' : 'Problems'} left.</p>
            {stored.plan.note && <p className="guide-note">{stored.plan.note}</p>}
            <button type="button" onClick={() => { onSave(withoutLearningPlan(save)); say('Learning Plan removed.'); }}>Remove Learning Plan</button>
          </>
        ) : <p>No Learning Plan.</p>}
      </section>
      <section>
        <h2>Reset</h2>
        <button type="button" onClick={() => setPending({ kind: Pending.Reset })}>Reset</button>
      </section>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primary" onClick={onTitle}>Title</button>
    </main>
  );
}
```

`src/ui/TitleScreen.tsx`: add `onGuide: () => void` to the props; render as the first child of `<main>`:
```tsx
      <button type="button" className="gear" aria-label="Guide" onClick={onGuide}>⚙</button>
```
Update the docstring to mention the Guide screen.

`src/App.tsx`: import `GuideScreen`; `Screen` gains `Guide: 'guide'`; new case:
```tsx
    case Screen.Guide:
      return (
        <GuideScreen
          save={save}
          onSave={persist}
          onReset={() => { persist(emptySave(PLAYER_ID)); setScreen(Screen.Create); }}
          onTitle={() => setScreen(save.character.name ? Screen.Title : Screen.Create)}
          now={now}
        />
      );
```
and `TitleScreen` gets `onGuide={() => setScreen(Screen.Guide)}`. Update App's docstring to include the Guide screen.

Append to `src/ui/styles.css`:
```css
.title { position: relative; }
.gear { position: absolute; top: 8px; right: 8px; min-height: 48px; padding: 4px 12px; font-size: 1.5rem; border-color: #b8b0a6; }
.guide { align-items: stretch; max-width: 720px; margin-inline: auto; }
.guide section { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 3px solid var(--frame); border-radius: 12px; background: #fff; }
.guide h2 { margin: 0; font-size: 1.2rem; }
.guide textarea { font: inherit; font-size: 0.9rem; font-family: ui-monospace, monospace; width: 100%; }
.guide-note { white-space: pre-wrap; }
```

- [ ] **Step 4: Run the files, the suite, typecheck, and the build**

Run: `npx vitest run src/ui/GuideScreen.test.tsx src/App.test.tsx && npm test && npm run typecheck && npm run build`
Expected: all pass; suite green; typecheck clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: Guide screen with Export, Import, and Reset behind a gear on the title"
```

---

## Out of scope for this plan (next plans)

1. **Skill locking and Fogged regions** once a second Skill exists; `unlockedSkills` is already stored.
2. **Tier thresholds** for later Skills in the plan's `thresholds`.
3. **A prompt template** for the offline loop: what to paste to Claude with an Export to get a Learning Plan back.
