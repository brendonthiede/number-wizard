# Screens, First Playable Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first thing the Player can play: title screen, Character creation, an Encounter screen with an on-screen keypad against Gob-nine, and the Encounter end.

**Architecture:** A pure orchestration module `src/game/play.ts` composes the existing engine into three calls (begin, next Problem, cast). `src/content/` holds hand-authored data. `src/ui/` holds thin React components that take props and callbacks; `App` owns state and writes through the injected `Store`. Save data bumps to version 3 for the Character's name and portrait.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 5 with jsdom and Testing Library for components that branch, plain CSS, Lexend self-hosted.

**Spec:** `docs/superpowers/specs/2026-09-16-screens-first-playable-design.md`. Engine interfaces: `docs/superpowers/specs/2026-09-16-encounter-and-combat-design.md`. Rules: `docs/design.md`. Vocabulary: `CONTEXT.md`.

## Global Constraints

- TDD is mandatory: failing test first, run it, then code, then run it. Paste RED and GREEN output in reports.
- CONTEXT.md terms in identifiers and test names: Player, Character, Encounter, Spell, Problem, Attempt, Hit, Critical Hit, Miss, Retreat, Level, Title, Loot. Never "user", "battle", "question", "session".
- No magic strings: state-like unions are `as const` objects with a derived type (`Outcome.Miss`, `EncounterStatus.Won`), compared by name. Tests may use literals.
- Comments state the constraint, not the investigation. One or two sentences.
- No commit trailers or attribution of any kind. Conventional subjects. Never `git push`.
- Engine and `play.ts` stay free of React and browser APIs; clock and RNG injected. `crypto.randomUUID` is the one platform call, behind an injectable `id` parameter.
- Component test files start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`. The Vitest default environment stays `node`.
- Feedback timings: 1500 ms for Hit, Critical Hit, Glancing Blow; 3000 ms for Miss. Answer capped at 4 digits. Times-table speed threshold 4000 ms.
- Content values: `PLAYER_ID = 'noah'`; `PORTRAITS = ['character-01', 'character-02', 'character-03']`; Quest 1 first Encounter: questId `fortress-of-twelves`, monsterId `gob-nine`, monsterName `Gob-nine`, monsterMaxHp 6, empty Loot pool.
- Art paths resolve as `${import.meta.env.BASE_URL}art/<kind>/<slug>.png`.

---

### Task 1: Content constants and save data version 3

**Files:**
- Create: `src/content/index.ts`
- Modify: `src/storage/save.ts`, `src/storage/save.test.ts`

**Interfaces:**
- Consumes: `Encounter`, `EncounterStatus` from `src/engine/combat.ts`; `Attempt` from `src/engine/types.ts`.
- Produces: `PLAYER_ID`, `PORTRAITS`, `QUEST_1_FIRST`, `interface EncounterTemplate { questId: string; monsterId: string; monsterName: string; monsterMaxHp: number; lootPool: string[] }` in `src/content/index.ts`; `SaveData.version: 3`, `SaveData.character: { name: string; portrait: string; xp: number }`, `withCharacter(data, name, portrait): SaveData`, `migrate` accepting versions 1, 2, 3.

- [ ] **Step 1: Write the content module**

`src/content/index.ts`:
```ts
export interface EncounterTemplate {
  questId: string;
  monsterId: string;
  monsterName: string;
  monsterMaxHp: number;
  lootPool: string[];
}

export const PLAYER_ID = 'noah';

export const PORTRAITS = ['character-01', 'character-02', 'character-03'] as const;

export const QUEST_1_FIRST: EncounterTemplate = {
  questId: 'fortress-of-twelves',
  monsterId: 'gob-nine',
  monsterName: 'Gob-nine',
  monsterMaxHp: 6,
  lootPool: [],
};
```

- [ ] **Step 2: Write the failing tests**

In `src/storage/save.test.ts`:

Change the import line to:
```ts
import { emptySave, memoryStore, migrate, withActiveEncounter, withAttempt, withCharacter, withEncounter } from './save';
```

Replace the `starts empty for a Player` test body's expectation with:
```ts
    expect(emptySave('noah')).toEqual({
      version: 3, playerId: 'noah', character: { name: '', portrait: 'character-01', xp: 0 },
      attempts: [], encounters: [], activeEncounter: null,
    });
```

Add after the `memoryStore round-trips` test, inside the same `describe('save data')`:
```ts
  it('withCharacter sets the name and portrait and keeps XP', () => {
    const data = withCharacter({ ...emptySave('noah'), character: { name: '', portrait: 'character-01', xp: 7 } }, 'Noah', 'character-03');
    expect(data.character).toEqual({ name: 'Noah', portrait: 'character-03', xp: 7 });
  });
```

In the `keeps XP from a Retreat` test, replace `{ ...emptySave('noah'), character: { xp: 10 } }` with:
```ts
{ ...emptySave('noah'), character: { ...emptySave('noah').character, xp: 10 } }
```

Replace the whole `describe('migrate', ...)` block with:
```ts
describe('migrate', () => {
  it('returns a version-3 save unchanged', () => {
    const data = emptySave('noah');
    expect(migrate(data)).toEqual(data);
  });

  it('upgrades a version-2 save: empty name, first portrait, XP kept (invariant 3)', () => {
    const v2 = { version: 2, playerId: 'noah', character: { xp: 25 }, attempts: [], encounters: [], activeEncounter: null };
    expect(migrate(v2)).toEqual({ ...v2, version: 3, character: { name: '', portrait: 'character-01', xp: 25 } });
  });

  it('upgrades a version-1 save all the way: XP 0, no Encounters, every Attempt gets an outcome', () => {
    const v1 = {
      version: 1, playerId: 'noah',
      attempts: [
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-15T12:00:00.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 5000, at: '2026-09-15T12:00:05.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 13, correct: false, durationMs: 1500, at: '2026-09-15T12:00:10.000Z', encounterId: 'e1' },
      ],
    };
    const data = migrate(v1);
    expect(data.version).toBe(3);
    expect(data.character).toEqual({ name: '', portrait: 'character-01', xp: 0 });
    expect(data.encounters).toEqual([]);
    expect(data.activeEncounter).toBeNull();
    expect(data.attempts.map((a) => a.outcome)).toEqual(['critical', 'hit', 'miss']);
    expect(data.attempts[0]).toMatchObject(v1.attempts[0]!);
  });

  it('throws on an unsupported version', () => {
    expect(() => migrate({ version: 4 })).toThrow('Unsupported save version: 4');
    expect(() => migrate(null)).toThrow('Unsupported save version: undefined');
  });

  it('throws on a corrupt save of each version', () => {
    expect(() => migrate({ version: 3 })).toThrow('Corrupt save data (version 3)');
    expect(() => migrate({ ...emptySave('noah'), character: { portrait: 'character-01', xp: 0 } })).toThrow('Corrupt save data (version 3)');
    expect(() => migrate({ version: 2 })).toThrow('Corrupt save data (version 2)');
    expect(() => migrate({ version: 1, playerId: 'noah' })).toThrow('Corrupt save data (version 1)');
  });

  it('throws on a save whose XP is not finite', () => {
    for (const xp of [NaN, Infinity]) {
      expect(() => migrate({ ...emptySave('noah'), character: { name: '', portrait: 'character-01', xp } })).toThrow('Corrupt save data (version 3)');
    }
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/storage/save.test.ts`
Expected: FAIL, `withCharacter` is not exported; version expectations mismatch.

- [ ] **Step 4: Implement version 3**

In `src/storage/save.ts`:

Add after the `Attempt` import:
```ts
import { PORTRAITS } from '../content';
```

Replace the `SaveData` interface and add `SaveV2` after `SaveV1`:
```ts
export interface SaveData {
  version: 3;
  playerId: string;
  character: { name: string; portrait: string; xp: number };
  attempts: Attempt[];
  encounters: EncounterRecord[];
  activeEncounter: Encounter | null;
}

interface SaveV1 {
  version: 1;
  playerId: string;
  attempts: Omit<Attempt, 'outcome'>[];
}

interface SaveV2 extends Omit<SaveData, 'version' | 'character'> {
  version: 2;
  character: { xp: number };
}
```

Replace the whole `migrate` function:
```ts
// The only copy of the Player's history lives in this blob (ADR-0001); every schema change lands here as a version bump plus a step in migrate. Each step upgrades one version and recurses.
export function migrate(raw: unknown): SaveData {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 3) {
    const data = raw as Partial<SaveData>;
    const valid = Array.isArray(data.attempts) && Array.isArray(data.encounters)
      && typeof data.character?.name === 'string' && typeof data.character.portrait === 'string'
      && Number.isFinite(data.character.xp) && typeof data.activeEncounter === 'object';
    if (!valid) throw new Error('Corrupt save data (version 3)');
    return raw as SaveData;
  }
  if (version === 2) {
    const old = raw as Partial<SaveV2>;
    const valid = Array.isArray(old.attempts) && Array.isArray(old.encounters)
      && Number.isFinite(old.character?.xp) && typeof old.activeEncounter === 'object';
    if (!valid) throw new Error('Corrupt save data (version 2)');
    return migrate({ ...old, version: 3, character: { name: '', portrait: PORTRAITS[0], xp: old.character!.xp } });
  }
  if (version === 1) {
    const old = raw as Partial<SaveV1>;
    if (!Array.isArray(old.attempts)) throw new Error('Corrupt save data (version 1)');
    // v1 only ever held times-table Attempts, which have no Work.
    const attempts = old.attempts.map((a) => ({
      ...a, outcome: resolveSpell({ ...a, workCorrect: true }, TIMES_TABLE_THRESHOLD_MS),
    }));
    return migrate({ version: 2, playerId: old.playerId!, character: { xp: 0 }, attempts, encounters: [], activeEncounter: null });
  }
  throw new Error(`Unsupported save version: ${String(version)}`);
}
```

Replace `emptySave` and add `withCharacter` after `withAttempt`:
```ts
export const emptySave = (playerId: string): SaveData => ({
  version: 3, playerId, character: { name: '', portrait: PORTRAITS[0], xp: 0 },
  attempts: [], encounters: [], activeEncounter: null,
});
```
```ts
export const withCharacter = (data: SaveData, name: string, portrait: string): SaveData => ({
  ...data,
  character: { ...data.character, name, portrait },
});
```

In `withEncounter`, change `character: { xp: data.character.xp + xp }` to:
```ts
character: { ...data.character, xp: data.character.xp + xp },
```

- [ ] **Step 5: Run the file, the suite, and typecheck**

Run: `npx vitest run src/storage/save.test.ts && npm test && npm run typecheck`
Expected: 17 tests pass in the file; suite green; typecheck clean. (`src/engine/playLoop.test.ts` still passes: it only reads `character.xp`.)

- [ ] **Step 6: Commit**

```bash
git add src/content/index.ts src/storage/save.ts src/storage/save.test.ts
git commit -m "feat: save data v3 with Character name and portrait, Quest 1 content constants"
```

---

### Task 2: Play orchestration

**Files:**
- Create: `src/game/play.ts`, `src/game/play.test.ts`
- Delete: `src/engine/playLoop.test.ts` (its invariant moves to `play.test.ts`, driven through `play.ts`)

**Interfaces:**
- Consumes: everything exported by `src/engine/*.ts`; `SaveData`, `withAttempt`, `withActiveEncounter`, `withEncounter` from `src/storage/save.ts`; `EncounterTemplate` from `src/content`.
- Produces: `beginEncounter(save, template, now, id?)`, `nextProblem(save, encounter, now, rng?)`, `cast(save, encounter, template, problem, answer, durationMs, now, rng?)`, `levelUp(xpBefore, xpAfter)`, re-exported `EncounterTemplate`.

- [ ] **Step 1: Write the failing tests**

`src/game/play.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { beginEncounter, cast, levelUp, nextProblem } from './play';
import { QUEST_1_FIRST, type EncounterTemplate } from '../content';
import { EncounterStatus, servedFacts } from '../engine/combat';
import { levelForXp, LEVEL_XP, maxHpForLevel } from '../engine/character';
import { Outcome } from '../engine/types';
import { emptySave, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-16T12:00:00.000Z');
let seed = 7;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const withXp = (xp: number): SaveData => ({ ...emptySave('noah'), character: { name: 'Noah', portrait: 'character-01', xp } });

describe('beginEncounter', () => {
  it('starts the Encounter from the template, stores it as activeEncounter, and uses the given id', () => {
    const { save, encounter } = beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');
    expect(encounter.spec).toEqual({ id: 'e1', questId: 'fortress-of-twelves', monsterId: 'gob-nine', monsterMaxHp: 6 });
    expect(encounter.status).toBe(EncounterStatus.Active);
    expect(save.activeEncounter).toEqual(encounter);
  });

  it('always starts the Character at the max HP for their Level (invariant 2)', () => {
    for (const xp of [0, 19, 20, 100, 480, 1750, 5000]) {
      const { encounter } = beginEncounter(withXp(xp), QUEST_1_FIRST, NOW, 'e1');
      expect(encounter.characterHp).toBe(maxHpForLevel(levelForXp(xp)));
      expect(encounter.characterMaxHp).toBe(encounter.characterHp);
    }
  });

  it('generates a unique id when none is given', () => {
    const a = beginEncounter(withXp(0), QUEST_1_FIRST, NOW).encounter.spec.id;
    const b = beginEncounter(withXp(0), QUEST_1_FIRST, NOW).encounter.spec.id;
    expect(a).not.toBe(b);
  });
});

describe('nextProblem', () => {
  it('serves only introduced rows (0 and 1) to a new Player', () => {
    const { save, encounter } = beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');
    for (let i = 0; i < 30; i++) {
      const p = nextProblem(save, encounter, NOW, rng);
      const [a, b] = p.prompt.split(' × ').map(Number);
      expect(a === 0 || a === 1 || b === 0 || b === 1).toBe(true);
      expect(p.answer).toBe(a! * b!);
    }
  });

  it('never repeats a Fact within an Encounter while unserved Facts remain', () => {
    let { save, encounter } = beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');
    const served: string[] = [];
    while (encounter.status === EncounterStatus.Active) {
      const p = nextProblem(save, encounter, NOW, rng);
      expect(servedFacts(encounter).has(p.factId)).toBe(false);
      served.push(p.factId);
      ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, null, 1000, NOW, rng)); // Miss every time
    }
    expect(new Set(served).size).toBe(served.length);
  });
});

describe('cast', () => {
  const start = () => beginEncounter(withXp(0), QUEST_1_FIRST, NOW, 'e1');

  it('a fast correct answer is a Critical Hit: Attempt appended, live Encounter updated', () => {
    const { save, encounter } = start();
    const p = nextProblem(save, encounter, NOW, rng);
    const r = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, rng);
    expect(r.outcome).toBe(Outcome.Critical);
    expect(r.encounter.monsterHp).toBe(4);
    expect(r.save.attempts).toHaveLength(1);
    expect(r.save.attempts[0]).toMatchObject({ factId: p.factId, answer: p.answer, correct: true, encounterId: 'e1', outcome: Outcome.Critical });
    expect(r.save.activeEncounter).toEqual(r.encounter);
  });

  it('a wrong answer is a Miss and costs a heart', () => {
    const { save, encounter } = start();
    const p = nextProblem(save, encounter, NOW, rng);
    const r = cast(save, encounter, QUEST_1_FIRST, p, p.answer + 1, 1000, NOW, rng);
    expect(r.outcome).toBe(Outcome.Miss);
    expect(r.encounter.characterHp).toBe(4);
  });

  it('records the Encounter with Loot from the template pool when it is won', () => {
    const template: EncounterTemplate = { ...QUEST_1_FIRST, monsterMaxHp: 2, lootPool: ['hat'] };
    const { save, encounter } = beginEncounter(withXp(0), template, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, rng);
    const r = cast(save, encounter, template, p, p.answer, 1000, NOW, rng);
    expect(r.encounter.status).toBe(EncounterStatus.Won);
    expect(r.save.activeEncounter).toBeNull();
    expect(r.save.encounters).toHaveLength(1);
    expect(r.save.encounters[0]).toMatchObject({ id: 'e1', status: EncounterStatus.Won, xp: 4, loot: 'hat' });
    expect(r.save.character.xp).toBe(4);
  });
});

describe('levelUp', () => {
  it('is true only when the Level grew', () => {
    expect(levelUp(0, LEVEL_XP[0]! - 1)).toBe(false);
    expect(levelUp(0, LEVEL_XP[0]!)).toBe(true);
    expect(levelUp(LEVEL_XP[0]!, LEVEL_XP[0]! + 5)).toBe(false);
  });
});

describe('playthrough through play.ts (invariant 1)', () => {
  it('keeps XP equal to the recorded sum, resolves every Attempt, never starves', () => {
    let save = withXp(0);
    let t = NOW.getTime();
    for (let i = 0; i < 100; i++) {
      t += 43_200_000;
      let { save: s, encounter } = beginEncounter(save, QUEST_1_FIRST, new Date(t), `e${i}`);
      save = s;
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, new Date(t), rng);
        const answer = rng() < 0.8 ? p.answer : p.answer + 1;
        ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, answer, rng() < 0.8 ? 1500 : 6000, new Date(t), rng));
      }
      expect(save.activeEncounter).toBeNull();
    }
    expect(save.encounters).toHaveLength(100);
    expect(save.character.xp).toBe(save.encounters.reduce((sum, r) => sum + r.xp, 0));
    const ids = new Set(save.encounters.map((r) => r.id));
    for (const a of save.attempts) expect(ids.has(a.encounterId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/play.test.ts`
Expected: FAIL, cannot resolve `./play`.

- [ ] **Step 3: Implement**

`src/game/play.ts`:
```ts
import type { EncounterTemplate } from '../content';
import { levelForXp, maxHpForLevel } from '../engine/character';
import { castSpell, rollLoot, servedFacts, startEncounter, EncounterStatus, type Encounter, type EncounterSpec } from '../engine/combat';
import { statusByFact, TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { inRows, introducedRows } from '../engine/rows';
import { buildPools, factWeight, pickFact } from '../engine/select';
import { timesTableFacts, timesTableProblem } from '../engine/timesTable';
import type { Attempt, Outcome, Problem } from '../engine/types';
import { withActiveEncounter, withAttempt, withEncounter, type SaveData } from '../storage/save';

export type { EncounterTemplate };

const FACTS = timesTableFacts();

export function beginEncounter(
  save: SaveData, template: EncounterTemplate, now: Date, id: string = crypto.randomUUID(),
): { save: SaveData; encounter: Encounter } {
  const spec: EncounterSpec = { id, questId: template.questId, monsterId: template.monsterId, monsterMaxHp: template.monsterMaxHp };
  const encounter = startEncounter(spec, maxHpForLevel(levelForXp(save.character.xp)), now);
  return { save: withActiveEncounter(save, encounter), encounter };
}

export function nextProblem(save: SaveData, encounter: Encounter, now: Date, rng: () => number = Math.random): Problem {
  const status = statusByFact(save.attempts, TIMES_TABLE_THRESHOLD_MS);
  const rows = introducedRows(status);
  const pools = buildPools(FACTS, status, (f) => inRows(f, rows), now);
  const byFact: Record<string, Attempt[]> = {};
  for (const a of save.attempts) (byFact[a.factId] ??= []).push(a);
  const fact = pickFact(pools, (f) => factWeight(byFact[f.id] ?? [], false), servedFacts(encounter), rng);
  // 91 Facts and pickFact's exhausted-pool fallback make null unreachable.
  if (!fact) throw new Error('No Fact to serve');
  return timesTableProblem(fact, rng);
}

export function cast(
  save: SaveData, encounter: Encounter, template: EncounterTemplate, problem: Problem,
  answer: number | null, durationMs: number, now: Date, rng: () => number = Math.random,
): { save: SaveData; encounter: Encounter; outcome: Outcome } {
  // Times-table Problems have no Work.
  const next = castSpell(encounter, { factId: problem.factId, answer, correct: answer === problem.answer, workCorrect: true, durationMs }, TIMES_TABLE_THRESHOLD_MS, now);
  const attempt = next.spells[next.spells.length - 1]!;
  const data = withAttempt(save, attempt);
  return {
    save: next.status === EncounterStatus.Active ? withActiveEncounter(data, next) : withEncounter(data, next, rollLoot(template.lootPool, rng)),
    encounter: next,
    outcome: attempt.outcome,
  };
}

export const levelUp = (xpBefore: number, xpAfter: number): boolean => levelForXp(xpAfter) > levelForXp(xpBefore);
```

- [ ] **Step 4: Delete the superseded engine-level play-loop test**

```bash
git rm src/engine/playLoop.test.ts
```

- [ ] **Step 5: Run the file, the suite, and typecheck**

Run: `npx vitest run src/game/play.test.ts && npm test && npm run typecheck`
Expected: 10 tests pass in the file; suite green; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/game/play.ts src/game/play.test.ts
git commit -m "feat: play orchestration over the engine (begin, next Problem, cast)"
```

---

### Task 3: Component test tooling, font, stylesheet, and the Keypad

**Files:**
- Modify: `package.json` (dev dependencies via npm), `index.html`
- Create: `public/fonts/lexend-latin.woff2`, `src/ui/styles.css`, `src/ui/art.ts`, `src/ui/Keypad.tsx`, `src/ui/Keypad.test.tsx`

**Interfaces:**
- Produces: `MAX_DIGITS`, `appendDigit(value, digit): string`, `Keypad({ value, onChange, onCast, disabled? })`, `art(path): string`, the stylesheet's class names used by later tasks: `screen`, `primary`, `key`, `keypad`, `panel`, `banner`, `answer`, `hearts`, `pips`, `portrait`, `portrait-card`.

- [ ] **Step 1: Install test tooling and the font**

```bash
npm install -D @testing-library/react @testing-library/dom @testing-library/user-event jsdom
mkdir -p public/fonts
URL=$(curl -sS -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120" "https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap" | awk '/\/\* latin \*\//{f=1} f && /src:/{match($0,/url\(([^)]+)\)/,m); print m[1]; exit}')
curl -sS -o public/fonts/lexend-latin.woff2 "$URL"
file public/fonts/lexend-latin.woff2
```
Expected: `Web Open Font Format (Version 2)`, about 40 KB. If the download fails, run `npm install @fontsource-variable/lexend` and `import '@fontsource-variable/lexend'` in `src/main.tsx` instead of the `@font-face` block below; the stylesheet's `--font` stays.

- [ ] **Step 2: Write the failing Keypad tests**

`src/ui/Keypad.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { appendDigit, Keypad, MAX_DIGITS } from './Keypad';

afterEach(cleanup);

function Harness({ onCast, disabled = false }: { onCast: (value: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <>
      <output data-testid="value">{value}</output>
      <Keypad value={value} onChange={setValue} onCast={() => onCast(value)} disabled={disabled} />
    </>
  );
}

describe('appendDigit', () => {
  it('never exceeds MAX_DIGITS and never keeps a leading zero (invariant 4)', () => {
    expect(appendDigit('', '0')).toBe('0');
    expect(appendDigit('0', '5')).toBe('5');
    expect(appendDigit('0', '0')).toBe('0');
    expect(appendDigit('12', '3')).toBe('123');
    expect(appendDigit('1234', '5')).toBe('1234');
    expect(MAX_DIGITS).toBe(4);
  });
});

describe('Keypad', () => {
  it('builds the answer from taps, removes with Backspace, and casts the value', () => {
    const onCast = vi.fn();
    render(<Harness onCast={onCast} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(screen.getByTestId('value').textContent).toBe('56');
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
    expect(onCast).toHaveBeenCalledWith('56');
  });

  it('disables Cast and Backspace while the answer is empty', () => {
    render(<Harness onCast={() => {}} />);
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Backspace' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables every key when disabled', () => {
    render(<Harness onCast={() => {}} disabled />);
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/ui/Keypad.test.tsx`
Expected: FAIL, cannot resolve `./Keypad`.

- [ ] **Step 4: Write the Keypad, the art helper, the stylesheet, and the font link**

`src/ui/art.ts`:
```ts
export const art = (path: string): string => `${import.meta.env.BASE_URL}art/${path}`;
```

`src/ui/Keypad.tsx`:
```tsx
export const MAX_DIGITS = 4;

export const appendDigit = (value: string, digit: string): string =>
  value.length >= MAX_DIGITS ? value : value === '0' ? digit : value + digit;

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onCast: () => void;
  disabled?: boolean;
}

export function Keypad({ value, onChange, onCast, disabled = false }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Keypad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className={d === '0' ? 'key key-zero' : 'key'} disabled={disabled} onClick={() => onChange(appendDigit(value, d))}>
          {d}
        </button>
      ))}
      <button type="button" className="key key-back" aria-label="Backspace" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))}>
        ⌫
      </button>
      <button type="button" className="key key-cast" disabled={disabled || !value} onClick={onCast}>
        Cast
      </button>
    </div>
  );
}
```

`src/ui/styles.css`:
```css
@font-face {
  font-family: 'Lexend';
  src: url('/fonts/lexend-latin.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --font: 'Lexend', system-ui, sans-serif;
  --bg: #f4efe6;
  --ink: #1f1a17;
  --frame: #2b2118;
  --accent: #3c7dd9;
  --accent-ink: #ffffff;
  --hit: #2f9e44;
  --miss: #d9480f;
  --key: 64px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font);
  font-size: 20px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: var(--ink);
  background: var(--bg);
}

.screen {
  min-height: 100vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

h1 { font-size: 2rem; margin: 0; }

button {
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  border-radius: 12px;
  border: 3px solid var(--frame);
  background: #fff;
  color: var(--ink);
  padding: 12px 24px;
  min-height: var(--key);
}
button:disabled { opacity: 0.4; cursor: default; }
.primary { background: var(--accent); color: var(--accent-ink); font-size: 1.25rem; }

.name { font: inherit; font-size: 1.25rem; padding: 8px 12px; border: 3px solid var(--frame); border-radius: 12px; }

.portraits { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.portrait-card { padding: 8px; }
.portrait-card[aria-checked='true'] { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent); }
.portrait-card img, .portrait { width: 160px; height: 160px; border-radius: 8px; }
.portrait-small { width: 48px; height: 48px; border-radius: 8px; }

.encounter {
  display: grid;
  grid-template-columns: minmax(0, 2fr) auto;
  grid-template-areas: 'status status' 'panel keypad' 'problem keypad';
  gap: 16px;
  align-items: start;
  width: 100%;
  max-width: 1100px;
}
.status { grid-area: status; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.fighter { display: flex; align-items: center; gap: 8px; }
.hearts { color: var(--miss); font-size: 1.5rem; letter-spacing: 0.1em; }
.pips { color: var(--hit); font-size: 1.5rem; letter-spacing: 0.1em; }

.panel {
  grid-area: panel;
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  border: 6px solid var(--frame);
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.monster { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); height: 80%; }
.banner {
  position: absolute;
  inset: auto 0 0 0;
  padding: 12px;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  background: rgb(0 0 0 / 0.65);
}

.problem { grid-area: problem; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 2.5rem; }
.answer {
  font: inherit;
  width: 5ch;
  text-align: center;
  border: 3px solid var(--frame);
  border-radius: 12px;
  background: #fff;
  caret-color: transparent;
}
.answer:focus { outline: 4px solid var(--accent); }

.keypad {
  grid-area: keypad;
  display: grid;
  grid-template-columns: repeat(3, var(--key)) var(--key);
  grid-template-areas: 'k7 k8 k9 back' 'k4 k5 k6 .' 'k1 k2 k3 cast' '. k0 . cast';
  gap: 8px;
}
.key { min-width: var(--key); min-height: var(--key); padding: 0; font-size: 1.5rem; }
.key-zero { grid-area: k0; }
.key-back { grid-area: back; }
.key-cast { grid-area: cast; background: var(--accent); color: var(--accent-ink); font-size: 1.1rem; }

.result .xp { font-size: 2rem; font-weight: 700; }
.levelup { color: var(--hit); font-size: 1.5rem; font-weight: 700; }

@media (max-width: 700px) {
  .encounter { grid-template-columns: 1fr; grid-template-areas: 'status' 'panel' 'problem' 'keypad'; justify-items: center; }
}
```

Vite rewrites the `/fonts/...` URL with the configured base (`/number-wizard/`) in both dev and build, because the file lives in `public/`.

- [ ] **Step 5: Run the file, the suite, and typecheck**

Run: `npx vitest run src/ui/Keypad.test.tsx && npm test && npm run typecheck`
Expected: 4 tests pass in the file; suite green; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json public/fonts/lexend-latin.woff2 src/ui/styles.css src/ui/art.ts src/ui/Keypad.tsx src/ui/Keypad.test.tsx
git commit -m "feat: Keypad component, stylesheet, self-hosted Lexend, component test tooling"
```

---

### Task 4: Encounter screen

**Files:**
- Create: `src/ui/Hp.tsx`, `src/ui/AnswerInput.tsx`, `src/ui/EncounterScreen.tsx`, `src/ui/EncounterScreen.test.tsx`

**Interfaces:**
- Consumes: `beginEncounter`, `nextProblem`, `cast`, `EncounterTemplate` from `src/game/play.ts`; `Keypad`, `appendDigit` from `src/ui/Keypad.tsx`; `art` from `src/ui/art.ts`; `Outcome` from `src/engine/types.ts`; `EncounterStatus`, `Encounter` from `src/engine/combat.ts`; `SaveData`, `withCharacter`, `emptySave` from `src/storage/save.ts`; `QUEST_1_FIRST` from `src/content`.
- Produces: `HpHearts({ hp, maxHp })`, `MonsterPips({ hp, maxHp })`, `AnswerInput({ value, onChange, onCast, disabled, focusKey })`, `FEEDBACK_MS`, `EncounterScreen({ save, encounter, template, onSave, onFinish, now?, rng? })` where `onFinish(save: SaveData, encounter: Encounter)`.

- [ ] **Step 1: Write the failing tests**

`src/ui/EncounterScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EncounterScreen, FEEDBACK_MS } from './EncounterScreen';
import { beginEncounter } from '../game/play';
import { QUEST_1_FIRST } from '../content';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter } from '../storage/save';

const T0 = Date.parse('2026-09-16T12:00:00.000Z');
let t = T0;
const now = () => new Date(t);
let seed = 3;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

beforeEach(() => { vi.useFakeTimers(); t = T0; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function mount(onFinish = vi.fn(), onSave = vi.fn()) {
  const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
  const { save, encounter } = beginEncounter(base, QUEST_1_FIRST, now(), 'e1');
  render(<EncounterScreen save={save} encounter={encounter} template={QUEST_1_FIRST} onSave={onSave} onFinish={onFinish} now={now} rng={rng} />);
  return { onFinish, onSave };
}

const input = () => screen.getByLabelText('Answer') as HTMLInputElement;
const currentAnswer = () => {
  const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
  return a! * b!;
};
const typeAndCast = (answer: number) => {
  for (const d of String(answer)) fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
};
const clearFeedback = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('EncounterScreen', () => {
  it('focuses the answer input on mount (invariant 7)', () => {
    mount();
    expect(document.activeElement).toBe(input());
  });

  it('shows both fighters at full HP with the monster name', () => {
    mount();
    expect(screen.getByLabelText('5 of 5 hearts')).toBeTruthy();
    expect(screen.getByLabelText('6 of 6 monster hit points')).toBeTruthy();
    expect(screen.getByText('Gob-nine')).toBeTruthy();
  });

  it('a fast correct cast is a Critical Hit: pips drop, feedback shows, input locked, then the next Problem is focused', () => {
    const { onSave } = mount();
    const first = screen.getByText(/=$/).textContent;
    typeAndCast(currentAnswer());
    expect(screen.getByRole('status').textContent).toBe('Critical Hit!');
    expect(screen.getByLabelText('4 of 6 monster hit points')).toBeTruthy();
    expect(input().disabled).toBe(true); // invariant 5
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    clearFeedback(FEEDBACK_MS.hit);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/=$/).textContent).not.toBe(first);
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
  });

  it('a slow correct cast is a Hit for 1', () => {
    mount();
    const answer = currentAnswer();
    t += 4500;
    typeAndCast(answer);
    expect(screen.getByRole('status').textContent).toBe('Hit!');
    expect(screen.getByLabelText('5 of 6 monster hit points')).toBeTruthy();
  });

  it('a Miss shows the correct answer for three seconds and costs a heart', () => {
    mount();
    const answer = currentAnswer();
    const prompt = screen.getByText(/=$/).textContent!.replace(/ =$/, '');
    typeAndCast(answer + 1);
    expect(screen.getByRole('status').textContent).toBe(`Miss. ${prompt} = ${answer}`);
    expect(screen.getByLabelText('4 of 5 hearts')).toBeTruthy();
    clearFeedback(FEEDBACK_MS.hit);
    expect(screen.getByRole('status')).toBeTruthy();
    clearFeedback(FEEDBACK_MS.miss - FEEDBACK_MS.hit);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hardware keys type digits, Backspace removes, Enter casts', () => {
    mount();
    fireEvent.keyDown(input(), { key: '5' });
    fireEvent.keyDown(input(), { key: '6' });
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(input().value).toBe('5');
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(input().value).toBe('');
    fireEvent.keyDown(input(), { key: 'Enter' }); // nothing to cast
    expect(screen.queryByRole('status')).toBeNull();
    for (const d of String(currentAnswer())) fireEvent.keyDown(input(), { key: d });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toBe('Critical Hit!');
  });

  it('calls onFinish with the finished Encounter and save after the last banner clears', () => {
    const { onFinish } = mount();
    for (let i = 0; i < 3; i++) {
      typeAndCast(currentAnswer());
      if (i < 2) clearFeedback(FEEDBACK_MS.hit);
    }
    expect(onFinish).not.toHaveBeenCalled();
    clearFeedback(FEEDBACK_MS.hit);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const [save, encounter] = onFinish.mock.calls[0]!;
    expect(encounter.status).toBe(EncounterStatus.Won);
    expect(save.activeEncounter).toBeNull();
    expect(save.encounters).toHaveLength(1);
    expect(save.character.xp).toBe(12);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/EncounterScreen.test.tsx`
Expected: FAIL, cannot resolve `./EncounterScreen`.

- [ ] **Step 3: Implement the three components**

`src/ui/Hp.tsx`:
```tsx
export const HpHearts = ({ hp, maxHp }: { hp: number; maxHp: number }) => (
  <span className="hearts" role="img" aria-label={`${hp} of ${maxHp} hearts`}>
    {'♥'.repeat(hp)}{'♡'.repeat(maxHp - hp)}
  </span>
);

export const MonsterPips = ({ hp, maxHp }: { hp: number; maxHp: number }) => (
  <span className="pips" role="img" aria-label={`${hp} of ${maxHp} monster hit points`}>
    {'▮'.repeat(hp)}{'▯'.repeat(maxHp - hp)}
  </span>
);
```

`src/ui/AnswerInput.tsx`:
```tsx
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { appendDigit } from './Keypad';

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onCast: () => void;
  disabled: boolean;
  focusKey: unknown;
}

// A real input so hardware typing needs no tap and Tab has somewhere to go once Work cells exist;
// inputMode="none" keeps a touch device's own keyboard away. Focus returns whenever the input
// re-enables or a new Problem (focusKey) appears.
export function AnswerInput({ value, onChange, onCast, disabled, focusKey }: AnswerInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled, focusKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (/^\d$/.test(e.key)) onChange(appendDigit(value, e.key));
    else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    else if (e.key === 'Enter' && value) onCast();
    else return;
    e.preventDefault();
  };

  return <input ref={ref} className="answer" inputMode="none" aria-label="Answer" value={value} readOnly disabled={disabled} onKeyDown={onKeyDown} />;
}
```

`src/ui/EncounterScreen.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { cast, nextProblem, type EncounterTemplate } from '../game/play';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { Outcome, type Problem } from '../engine/types';
import type { SaveData } from '../storage/save';
import { AnswerInput } from './AnswerInput';
import { art } from './art';
import { HpHearts, MonsterPips } from './Hp';
import { Keypad } from './Keypad';

export const FEEDBACK_MS = { hit: 1500, miss: 3000 } as const;

const BANNER: Record<Exclude<Outcome, typeof Outcome.Miss>, string> = {
  [Outcome.Critical]: 'Critical Hit!',
  [Outcome.Hit]: 'Hit!',
  [Outcome.Glancing]: 'Glancing Blow!',
};

interface Feedback {
  outcome: Outcome;
  problem: Problem;
}

const bannerText = ({ outcome, problem }: Feedback): string =>
  outcome === Outcome.Miss ? `Miss. ${problem.prompt} = ${problem.answer}` : BANNER[outcome];

interface EncounterScreenProps {
  save: SaveData;
  encounter: Encounter;
  template: EncounterTemplate;
  onSave: (save: SaveData) => void;
  onFinish: (save: SaveData, encounter: Encounter) => void;
  now?: () => Date;
  rng?: () => number;
}

export function EncounterScreen({ save, encounter, template, onSave, onFinish, now = () => new Date(), rng = Math.random }: EncounterScreenProps) {
  const [state, setState] = useState({ save, encounter });
  const [problem, setProblem] = useState(() => nextProblem(save, encounter, now(), rng));
  const [shownAt, setShownAt] = useState(() => now().getTime());
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const doCast = () => {
    if (!value || feedback) return;
    const at = now();
    const result = cast(state.save, state.encounter, template, problem, Number(value), at.getTime() - shownAt, at, rng);
    setState(result);
    onSave(result.save);
    setFeedback({ outcome: result.outcome, problem });
    setValue('');
  };

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
      if (state.encounter.status !== EncounterStatus.Active) {
        onFinish(state.save, state.encounter);
        return;
      }
      setProblem(nextProblem(state.save, state.encounter, now(), rng));
      setShownAt(now().getTime());
    }, feedback.outcome === Outcome.Miss ? FEEDBACK_MS.miss : FEEDBACK_MS.hit);
    return () => clearTimeout(timer);
  }, [feedback]);

  const { character } = state.save;
  const e = state.encounter;
  const locked = feedback !== null;

  return (
    <main className="screen encounter">
      <header className="status">
        <div className="fighter">
          <img className="portrait-small" src={art(`character/${character.portrait}.png`)} alt="" />
          <span>{character.name}</span>
          <HpHearts hp={e.characterHp} maxHp={e.characterMaxHp} />
        </div>
        <div className="fighter">
          <span>{template.monsterName}</span>
          <MonsterPips hp={e.monsterHp} maxHp={e.spec.monsterMaxHp} />
        </div>
      </header>
      <section className="panel" style={{ backgroundImage: `url(${art('background/castle-02.png')})` }}>
        <img className="monster" src={art(`monster/${e.spec.monsterId}.png`)} alt="" />
        {feedback && <div className="banner" role="status">{bannerText(feedback)}</div>}
      </section>
      <section className="problem">
        <span className="prompt">{problem.prompt} =</span>
        <AnswerInput value={value} onChange={setValue} onCast={doCast} disabled={locked} focusKey={problem} />
      </section>
      <Keypad value={value} onChange={setValue} onCast={doCast} disabled={locked} />
    </main>
  );
}
```

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/ui/EncounterScreen.test.tsx && npm test && npm run typecheck`
Expected: 7 tests pass in the file; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Hp.tsx src/ui/AnswerInput.tsx src/ui/EncounterScreen.tsx src/ui/EncounterScreen.test.tsx
git commit -m "feat: Encounter screen with keypad, feedback banner, and focused answer input"
```

---

### Task 5: Title, Character creation, result, and App wiring

**Files:**
- Create: `src/ui/TitleScreen.tsx`, `src/ui/CreateScreen.tsx`, `src/ui/CreateScreen.test.tsx`, `src/ui/ResultScreen.tsx`, `src/App.test.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Delete: `src/App.test.ts`
- Modify: `docs/superpowers/specs/2026-09-16-screens-first-playable-design.md` (signatures that changed during implementation)

**Interfaces:**
- Consumes: `EncounterScreen` (Task 4), `beginEncounter`, `levelUp` (Task 2), `PLAYER_ID`, `PORTRAITS`, `QUEST_1_FIRST` (Task 1), `Store`, `emptySave`, `withCharacter`, `SaveData` from `src/storage/save.ts`, `idbStore`, `levelForXp`, `titleForLevel` from `src/engine/character.ts`, `EncounterStatus`, `Encounter` from `src/engine/combat.ts`, `art`.
- Produces: `TitleScreen({ save, onPlay })`, `CreateScreen({ onBegin })`, `ResultScreen({ save, encounter, xpBefore, onAgain, onTitle })`, `App({ store })`, `APP_TITLE`, `Screen` const object.

- [ ] **Step 1: Write the failing tests**

`src/ui/CreateScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateScreen } from './CreateScreen';

afterEach(cleanup);

const begin = () => screen.getByRole('button', { name: 'Begin' }) as HTMLButtonElement;

describe('CreateScreen', () => {
  it('enables Begin only once a name and a portrait are chosen, then reports both', () => {
    const onBegin = vi.fn();
    render(<CreateScreen onBegin={onBegin} />);
    expect(begin().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Noah ' } });
    expect(begin().disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'character-02' }));
    expect(begin().disabled).toBe(false);
    fireEvent.click(begin());
    expect(onBegin).toHaveBeenCalledWith('Noah', 'character-02');
  });

  it('offers the three portraits and marks the chosen one', () => {
    render(<CreateScreen onBegin={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: 'character-03' }));
    expect(screen.getByRole('radio', { name: 'character-03' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'character-01' }).getAttribute('aria-checked')).toBe('false');
  });
});
```

`src/App.test.tsx` (replaces `src/App.test.ts`):
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App, APP_TITLE } from './App';
import { beginEncounter } from './game/play';
import { QUEST_1_FIRST } from './content';
import { emptySave, memoryStore, withCharacter } from './storage/save';

afterEach(cleanup);

const named = () => withCharacter(emptySave('noah'), 'Noah', 'character-01');

describe('App', () => {
  it('has the game title', () => {
    expect(APP_TITLE).toBe('Number Wizard');
  });

  it('shows Character creation when the save has no name, then the title after Begin', async () => {
    const store = memoryStore();
    render(<App store={store} />);
    expect(await screen.findByText('Who are you?')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Noah' } });
    fireEvent.click(screen.getByRole('radio', { name: 'character-02' }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy();
    expect((await store.load())?.character).toEqual({ name: 'Noah', portrait: 'character-02', xp: 0 });
  });

  it('shows the title with Play for an existing Character, and Play opens an Encounter', async () => {
    const store = memoryStore();
    await store.save(named());
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    expect(await screen.findByLabelText('Answer')).toBeTruthy();
    expect((await store.load())?.activeEncounter).not.toBeNull();
  });

  it('resumes an active Encounter on load instead of showing the title (invariant 6)', async () => {
    const store = memoryStore();
    await store.save(beginEncounter(named(), QUEST_1_FIRST, new Date(), 'e1').save);
    render(<App store={store} />);
    expect(await screen.findByLabelText('Answer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `git rm -q src/App.test.ts && npx vitest run src/ui/CreateScreen.test.tsx src/App.test.tsx`
Expected: FAIL, cannot resolve `./CreateScreen`; `App` has no `store` prop.

- [ ] **Step 3: Implement the screens and App**

`src/ui/TitleScreen.tsx`:
```tsx
import { levelForXp, titleForLevel } from '../engine/character';
import type { SaveData } from '../storage/save';
import { art } from './art';

export function TitleScreen({ save, onPlay }: { save: SaveData; onPlay: () => void }) {
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen title">
      <h1>Number Wizard</h1>
      <img className="portrait" src={art(`character/${save.character.portrait}.png`)} alt="" />
      <p>{save.character.name}, {titleForLevel(level)} (Level {level})</p>
      <button type="button" className="primary" onClick={onPlay}>{save.activeEncounter ? 'Continue' : 'Play'}</button>
    </main>
  );
}
```

`src/ui/CreateScreen.tsx`:
```tsx
import { useState } from 'react';
import { PORTRAITS } from '../content';
import { art } from './art';

export function CreateScreen({ onBegin }: { onBegin: (name: string, portrait: string) => void }) {
  const [name, setName] = useState('');
  const [portrait, setPortrait] = useState<string | null>(null);
  const ready = name.trim().length > 0 && portrait !== null;
  return (
    <main className="screen create">
      <h1>Who are you?</h1>
      <label>
        Name <input className="name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="portraits" role="radiogroup" aria-label="Portrait">
        {PORTRAITS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={portrait === p} aria-label={p} className="portrait-card" onClick={() => setPortrait(p)}>
            <img src={art(`character/${p}.png`)} alt="" />
          </button>
        ))}
      </div>
      <button type="button" className="primary" disabled={!ready} onClick={() => onBegin(name.trim(), portrait!)}>Begin</button>
    </main>
  );
}
```

`src/ui/ResultScreen.tsx`:
```tsx
import { levelForXp, titleForLevel } from '../engine/character';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { levelUp } from '../game/play';
import type { SaveData } from '../storage/save';

interface ResultScreenProps {
  save: SaveData;
  encounter: Encounter;
  xpBefore: number;
  onAgain: () => void;
  onTitle: () => void;
}

export function ResultScreen({ save, encounter, xpBefore, onAgain, onTitle }: ResultScreenProps) {
  const won = encounter.status === EncounterStatus.Won;
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen result">
      <h1>{won ? 'Victory!' : 'You retreat to fight another day.'}</h1>
      <p className="xp">+{save.character.xp - xpBefore} XP</p>
      {levelUp(xpBefore, save.character.xp) && (
        <p className="levelup" role="status">Level up! You are now Level {level}, {titleForLevel(level)}.</p>
      )}
      <p>Level {level} {titleForLevel(level)}</p>
      <button type="button" className="primary" onClick={onAgain}>Fight again</button>
      <button type="button" onClick={onTitle}>Title</button>
    </main>
  );
}
```

`src/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { PLAYER_ID, QUEST_1_FIRST } from './content';
import type { Encounter } from './engine/combat';
import { beginEncounter } from './game/play';
import { emptySave, withCharacter, type SaveData, type Store } from './storage/save';
import { CreateScreen } from './ui/CreateScreen';
import { EncounterScreen } from './ui/EncounterScreen';
import { ResultScreen } from './ui/ResultScreen';
import { TitleScreen } from './ui/TitleScreen';

export const APP_TITLE = 'Number Wizard';

const Screen = { Title: 'title', Create: 'create', Encounter: 'encounter', Result: 'result' } as const;
type Screen = (typeof Screen)[keyof typeof Screen];

export function App({ store }: { store: Store }) {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>(Screen.Title);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [xpBefore, setXpBefore] = useState(0);

  // The store is the only copy of the Player's history; a failed write is logged, never shown as an error mid-Encounter.
  const persist = (data: SaveData) => {
    setSave(data);
    store.save(data).catch((err: unknown) => console.error('save failed', err));
  };

  const play = (data: SaveData) => {
    setXpBefore(data.character.xp);
    if (data.activeEncounter) {
      setEncounter(data.activeEncounter);
    } else {
      const begun = beginEncounter(data, QUEST_1_FIRST, new Date());
      persist(begun.save);
      setEncounter(begun.encounter);
    }
    setScreen(Screen.Encounter);
  };

  useEffect(() => {
    let cancelled = false;
    store.load().then((loaded) => {
      if (cancelled) return;
      const data = loaded ?? emptySave(PLAYER_ID);
      setSave(data);
      if (!data.character.name) setScreen(Screen.Create);
      else if (data.activeEncounter) play(data);
    });
    return () => { cancelled = true; };
  }, [store]);

  if (!save) return null;

  switch (screen) {
    case Screen.Create:
      return <CreateScreen onBegin={(name, portrait) => { persist(withCharacter(save, name, portrait)); setScreen(Screen.Title); }} />;
    case Screen.Encounter:
      return (
        <EncounterScreen
          key={encounter!.spec.id}
          save={save}
          encounter={encounter!}
          template={QUEST_1_FIRST}
          onSave={persist}
          onFinish={(data, finished) => { persist(data); setEncounter(finished); setScreen(Screen.Result); }}
        />
      );
    case Screen.Result:
      return <ResultScreen save={save} encounter={encounter!} xpBefore={xpBefore} onAgain={() => play(save)} onTitle={() => setScreen(Screen.Title)} />;
    default:
      return <TitleScreen save={save} onPlay={() => play(save)} />;
  }
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { idbStore } from './storage/save';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={idbStore()} />
  </StrictMode>,
);
```

- [ ] **Step 4: Run the files, the suite, typecheck, and the production build**

Run: `npx vitest run src/ui/CreateScreen.test.tsx src/App.test.tsx && npm test && npm run typecheck && npm run build`
Expected: 2 and 4 tests pass in the two files; suite green; typecheck clean; `dist/` builds with the font and art under `dist/fonts` and `dist/art`.

- [ ] **Step 5: Align the spec with the shipped signatures**

In `docs/superpowers/specs/2026-09-16-screens-first-playable-design.md`, in the Interfaces section:
- `cast` gains `template: EncounterTemplate` as its third parameter (the Loot pool comes from it).
- `levelUp(xpBefore: number, xpAfter: number): boolean` takes XP numbers, not saves.
- `beginEncounter` gains an optional fourth parameter `id?: string` (defaults to `crypto.randomUUID()`).
- `EncounterScreen.onFinish` is `(save, encounter) => void`; `App` keeps `xpBefore` itself.
- `EncounterTemplate` is defined in `src/content/index.ts` and re-exported from `play.ts`.

- [ ] **Step 6: Smoke test in the browser**

Run: `npm run dev` and open the printed URL in a browser.
Check: the create screen shows three portraits; Begin leads to the title; Play opens the Encounter with Gob-nine over the castle, the answer box focused, and hardware digits typing into it; a correct answer shows "Critical Hit!"; three correct answers reach "Victory!" with +12 XP; reload mid-Encounter returns to the Encounter. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/main.tsx src/ui/TitleScreen.tsx src/ui/CreateScreen.tsx src/ui/CreateScreen.test.tsx src/ui/ResultScreen.tsx docs/superpowers/specs/2026-09-16-screens-first-playable-design.md
git commit -m "feat: title, Character creation, result screens, and App wiring to the save store"
```

---

## Out of scope for this plan (next plans)

1. **Guide screen**: gear icon, Export JSON, Learning Plan import, Reset.
2. **Map and trophy case**: needs Achievements and Quest 1 content.
3. **PWA**: manifest and service worker; the font is already self-hosted.
4. **Sound and music** with CC0 or CC-BY sources and an attribution file.
5. **Work grids** for multi-digit multiplication and long division; Tab order across cells.
6. **Loot display** once a Quest has a pool; **Quest 1 story panels** and monster roster.
