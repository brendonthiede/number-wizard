# Encounter and Combat Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pure-logic combat for the game layer: Spell outcomes, an Encounter reducer, XP/Level/Title, a Loot roll, and save data version 2 that records all of it.

**Architecture:** Two new modules in `src/engine/` (`combat.ts`, `character.ts`) follow the existing pattern: pure functions over plain data, clock and RNG injected, no React or browser APIs. `Attempt` gains an `outcome` so the per-Spell record lives in the Attempt history the AI consumer already reads. `src/storage/save.ts` bumps to version 2 through the existing `migrate` seam.

**Tech Stack:** TypeScript 7, Vitest 5 (node environment). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-16-encounter-and-combat-design.md`. Rules: `docs/design.md` (Adventure). Vocabulary: `CONTEXT.md`.

## Global Constraints

- TDD is mandatory: failing test first, then code, every task. Run the named test before and after.
- Use `CONTEXT.md` terms in identifiers and test names: Encounter, Spell, Hit, Critical Hit, Glancing Blow, Miss, Retreat, Attempt, Loot, Level, Title. Never "battle", "attack", "crit", "reward".
- No commit trailers or attribution of any kind. Conventional-commit subjects (`feat:`, `test:`, `docs:`).
- Outcomes: Critical Hit = correct, Work correct, `durationMs < thresholdMs`, 2 damage. Hit = correct, Work correct, at or over threshold, 1 damage. Glancing Blow = correct with Work wrong, any speed, 1 damage, never Critical. Miss = incorrect, 0 damage, Character loses 1 HP.
- Encounter ends `won` at monster HP 0, `retreated` at Character HP 0. Full Character HP at every start. Retreat keeps all XP.
- XP = damage dealt (monster max HP minus remaining HP) plus monster max HP on a win. Cumulative XP for Level 2 onward: 20, 50, 100, 180, 300, 480, 750, 1150, 1750. Max HP = 5 at Level 1, +1 per Level, cap 10. Titles: Apprentice 1 to 3, Adept 4 to 6, Wizard 7+.
- Engine stays free of React and browser APIs so it runs under Vitest's node environment.
- Each task includes at least one invariant test written from the spec's Testing section, marked `(invariant N)` in its name.

---

### Task 1: Spell outcomes and the `outcome` field on Attempt

**Files:**
- Modify: `src/engine/types.ts` (add `Outcome`, add `outcome` to `Attempt`)
- Create: `src/engine/combat.ts`, `src/engine/combat.test.ts`
- Modify fixtures: `src/engine/mastery.test.ts:8-16`, `src/engine/select.test.ts:11`, `src/storage/save.test.ts:5-8`

**Interfaces:**
- Consumes: `FactId` from `src/engine/types.ts`.
- Produces: `type Outcome = 'critical' | 'hit' | 'glancing' | 'miss'` (in `types.ts`); `Attempt.outcome: Outcome`; in `combat.ts`: `interface SpellInput { factId: FactId; answer: number | null; correct: boolean; workCorrect: boolean; durationMs: number }`, `resolveSpell(input: SpellInput, thresholdMs: number): Outcome`, `damageOf(outcome: Outcome): number`.

- [ ] **Step 1: Write the failing tests**

`src/engine/combat.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { damageOf, resolveSpell, type SpellInput } from './combat';

const T = 4000;
const spell = (over: Partial<SpellInput> = {}): SpellInput => ({
  factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 2000, ...over,
});

describe('resolveSpell', () => {
  it('is a Critical Hit when correct, Work correct, and under the threshold', () => {
    expect(resolveSpell(spell({ durationMs: 3999 }), T)).toBe('critical');
  });

  it('is a Hit at or over the threshold', () => {
    expect(resolveSpell(spell({ durationMs: 4000 }), T)).toBe('hit');
    expect(resolveSpell(spell({ durationMs: 60000 }), T)).toBe('hit');
  });

  it('is a Glancing Blow when some Work is wrong, at any speed (invariant 5)', () => {
    for (const durationMs of [0, 1, 3999, 4000, 60000]) {
      expect(resolveSpell(spell({ workCorrect: false, durationMs }), T)).toBe('glancing');
    }
  });

  it('is a Miss when the final answer is wrong, however fast and whatever the Work', () => {
    expect(resolveSpell(spell({ correct: false, answer: 13, durationMs: 1 }), T)).toBe('miss');
    expect(resolveSpell(spell({ correct: false, workCorrect: false }), T)).toBe('miss');
  });
});

describe('damageOf', () => {
  it('deals 2 for a Critical Hit, 1 for a Hit or Glancing Blow, 0 for a Miss', () => {
    expect(damageOf('critical')).toBe(2);
    expect(damageOf('hit')).toBe(1);
    expect(damageOf('glancing')).toBe(1);
    expect(damageOf('miss')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: FAIL, cannot resolve `./combat`.

- [ ] **Step 3: Add the type and the module**

In `src/engine/types.ts`, add directly above `export interface Attempt`:
```ts
export type Outcome = 'critical' | 'hit' | 'glancing' | 'miss';
```
and inside `Attempt`, after `encounterId: string;`:
```ts
  outcome: Outcome;
```

`src/engine/combat.ts`:
```ts
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
```

- [ ] **Step 4: Fix the existing Attempt fixtures so typecheck passes**

`src/engine/mastery.test.ts` line 14, after `encounterId: 'e1',` add `outcome: 'critical',`.

`src/engine/select.test.ts` line 11 becomes:
```ts
const miss = (): Attempt => ({ factId: 'x', answer: 0, correct: false, durationMs: 1, at: '', encounterId: 'e', outcome: 'miss' });
```
and line 12:
```ts
const hit = (): Attempt => ({ ...miss(), correct: true, outcome: 'hit' });
```

`src/storage/save.test.ts` lines 5 to 8 become:
```ts
const attempt: Attempt = {
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500,
  at: '2026-09-15T12:00:00.000Z', encounterId: 'e1', outcome: 'critical',
};
```

- [ ] **Step 5: Run the file, the suite, and typecheck**

Run: `npx vitest run src/engine/combat.test.ts && npm test && npm run typecheck`
Expected: 5 tests pass in the file; suite green (37 tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/combat.ts src/engine/combat.test.ts src/engine/mastery.test.ts src/engine/select.test.ts src/storage/save.test.ts
git commit -m "feat: Spell outcomes and Attempt.outcome"
```

---

### Task 2: Encounter reducer and Loot roll

**Files:**
- Modify: `src/engine/combat.ts`, `src/engine/combat.test.ts`

**Interfaces:**
- Consumes: `resolveSpell`, `damageOf`, `SpellInput` (Task 1); `Attempt`, `FactId` from `types.ts`.
- Produces: `interface EncounterSpec { id: string; questId: string; monsterId: string; monsterMaxHp: number }`; `type EncounterStatus = 'active' | 'won' | 'retreated'`; `interface Encounter { spec: EncounterSpec; monsterHp: number; characterHp: number; characterMaxHp: number; spells: Attempt[]; startedAt: string; status: EncounterStatus }`; `startEncounter(spec: EncounterSpec, characterMaxHp: number, now: Date): Encounter`; `castSpell(encounter: Encounter, input: SpellInput, thresholdMs: number, now: Date): Encounter`; `servedFacts(encounter: Encounter): Set<FactId>`; `rollLoot(pool: string[], rng?: () => number): string | null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/combat.test.ts` (extend the import line to `import { castSpell, damageOf, resolveSpell, rollLoot, servedFacts, startEncounter, type EncounterSpec, type SpellInput } from './combat';`):
```ts
const NOW = new Date('2026-09-16T12:00:00.000Z');
const spec: EncounterSpec = { id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 3 };

describe('startEncounter', () => {
  it('starts with the monster at max HP and the Character at full HP', () => {
    expect(startEncounter(spec, 5, NOW)).toEqual({
      spec, monsterHp: 3, characterHp: 5, characterMaxHp: 5, spells: [], startedAt: NOW.toISOString(), status: 'active',
    });
  });
});

describe('castSpell', () => {
  it('records the Attempt with its outcome and damages the monster on a Hit', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), spell({ durationMs: 5000 }), T, NOW);
    expect(e.monsterHp).toBe(2);
    expect(e.characterHp).toBe(5);
    expect(e.spells).toEqual([{
      factId: 'tt:3x4', answer: 12, correct: true, durationMs: 5000,
      at: NOW.toISOString(), encounterId: 'e1', outcome: 'hit',
    }]);
    expect(e.status).toBe('active');
  });

  it('costs the Character 1 HP on a Miss and leaves the monster alone', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), spell({ correct: false }), T, NOW);
    expect(e.monsterHp).toBe(3);
    expect(e.characterHp).toBe(4);
  });

  it('is won when monster HP reaches 0, never below', () => {
    let e = castSpell(startEncounter(spec, 5, NOW), spell(), T, NOW); // critical, 2
    e = castSpell(e, spell(), T, NOW); // critical, 2 more; overkill
    expect(e.monsterHp).toBe(0);
    expect(e.status).toBe('won');
  });

  it('is retreated when Character HP reaches 0', () => {
    let e = startEncounter(spec, 2, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    expect(e.characterHp).toBe(0);
    expect(e.status).toBe('retreated');
  });

  it('throws once the Encounter has ended', () => {
    let e = startEncounter(spec, 1, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    expect(() => castSpell(e, spell(), T, NOW)).toThrow('Encounter e1 is retreated');
  });

  it('does not mutate the previous Encounter', () => {
    const before = startEncounter(spec, 5, NOW);
    castSpell(before, spell(), T, NOW);
    expect(before.spells).toEqual([]);
    expect(before.monsterHp).toBe(3);
  });

  it('always ends within monster max HP plus Character max HP Spells (invariant 1)', () => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let run = 0; run < 200; run++) {
      const big = { ...spec, monsterMaxHp: 1 + Math.floor(rng() * 15) };
      const maxHp = 5 + Math.floor(rng() * 6);
      let e = startEncounter(big, maxHp, NOW);
      let casts = 0;
      while (e.status === 'active') {
        e = castSpell(e, spell({ correct: rng() < 0.6, workCorrect: rng() < 0.8, durationMs: rng() * 8000 }), T, NOW);
        casts++;
        expect(casts).toBeLessThanOrEqual(big.monsterMaxHp + maxHp);
      }
    }
  });
});

describe('servedFacts', () => {
  it('is the set of Facts cast so far', () => {
    let e = startEncounter(spec, 5, NOW);
    e = castSpell(e, spell({ factId: 'tt:2x2', correct: false }), T, NOW);
    e = castSpell(e, spell({ factId: 'tt:2x3', correct: false }), T, NOW);
    e = castSpell(e, spell({ factId: 'tt:2x2', correct: false }), T, NOW);
    expect([...servedFacts(e)].sort()).toEqual(['tt:2x2', 'tt:2x3']);
  });
});

describe('rollLoot', () => {
  it('picks one id from the pool by the RNG, or null from an empty pool', () => {
    expect(rollLoot(['hat', 'staff', 'cloak'], () => 0.5)).toBe('staff');
    expect(rollLoot(['hat', 'staff', 'cloak'], () => 0.999)).toBe('cloak');
    expect(rollLoot([], () => 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: FAIL, `startEncounter` and friends are not exported.

- [ ] **Step 3: Implement**

Append to `src/engine/combat.ts` (change the import line to `import type { Attempt, FactId, Outcome } from './types';`):
```ts
export interface EncounterSpec {
  id: string;
  questId: string;
  monsterId: string;
  monsterMaxHp: number;
}

export type EncounterStatus = 'active' | 'won' | 'retreated';

export interface Encounter {
  spec: EncounterSpec;
  monsterHp: number;
  characterHp: number;
  characterMaxHp: number;
  spells: Attempt[];
  startedAt: string;
  status: EncounterStatus;
}

export function startEncounter(spec: EncounterSpec, characterMaxHp: number, now: Date): Encounter {
  return {
    spec, monsterHp: spec.monsterMaxHp, characterHp: characterMaxHp, characterMaxHp,
    spells: [], startedAt: now.toISOString(), status: 'active',
  };
}

export function castSpell(encounter: Encounter, input: SpellInput, thresholdMs: number, now: Date): Encounter {
  if (encounter.status !== 'active') throw new Error(`Encounter ${encounter.spec.id} is ${encounter.status}`);
  const outcome = resolveSpell(input, thresholdMs);
  const attempt: Attempt = {
    factId: input.factId, answer: input.answer, correct: input.correct, durationMs: input.durationMs,
    at: now.toISOString(), encounterId: encounter.spec.id, outcome,
  };
  const monsterHp = Math.max(0, encounter.monsterHp - damageOf(outcome));
  const characterHp = Math.max(0, encounter.characterHp - (outcome === 'miss' ? 1 : 0));
  const status: EncounterStatus = monsterHp === 0 ? 'won' : characterHp === 0 ? 'retreated' : 'active';
  return { ...encounter, monsterHp, characterHp, spells: [...encounter.spells, attempt], status };
}

export const servedFacts = (encounter: Encounter): Set<FactId> => new Set(encounter.spells.map((s) => s.factId));

export const rollLoot = (pool: string[], rng: () => number = Math.random): string | null =>
  pool.length ? pool[Math.floor(rng() * pool.length)]! : null;
```

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/engine/combat.test.ts && npm test && npm run typecheck`
Expected: 15 tests pass in the file; suite green (47 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/combat.ts src/engine/combat.test.ts
git commit -m "feat: Encounter reducer with Hit, Critical Hit, Glancing Blow, Miss, and Retreat"
```

---

### Task 3: XP, Level, Title, and Encounter XP

**Files:**
- Create: `src/engine/character.ts`, `src/engine/character.test.ts`

**Interfaces:**
- Consumes: `Encounter`, `EncounterSpec`, `startEncounter`, `castSpell` from `src/engine/combat.ts` (Task 2).
- Produces: `LEVEL_XP: number[]` (cumulative, index 0 is Level 2); `levelForXp(xp: number): number`; `maxHpForLevel(level: number): number`; `type Title = 'Apprentice' | 'Adept' | 'Wizard'`; `titleForLevel(level: number): Title`; `encounterXp(encounter: Encounter): number`.

- [ ] **Step 1: Write the failing tests**

`src/engine/character.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { encounterXp, LEVEL_XP, levelForXp, maxHpForLevel, titleForLevel } from './character';
import { castSpell, startEncounter, type EncounterSpec, type SpellInput } from './combat';

const T = 4000;
const NOW = new Date('2026-09-16T12:00:00.000Z');
const spec: EncounterSpec = { id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 6 };
const spell = (over: Partial<SpellInput> = {}): SpellInput => ({
  factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 2000, ...over,
});

describe('levelForXp', () => {
  it('is Level 1 below the first threshold and climbs one Level per threshold', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(19)).toBe(1);
    expect(levelForXp(20)).toBe(2);
    expect(levelForXp(49)).toBe(2);
    expect(levelForXp(50)).toBe(3);
    expect(levelForXp(1750)).toBe(LEVEL_XP.length + 1);
    expect(levelForXp(999999)).toBe(LEVEL_XP.length + 1);
  });

  it('never decreases as XP grows (invariant 4)', () => {
    let last = 0;
    for (let xp = 0; xp <= 2000; xp++) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });
});

describe('maxHpForLevel', () => {
  it('starts at 5, gains 1 per Level, and caps at 10', () => {
    expect(maxHpForLevel(1)).toBe(5);
    expect(maxHpForLevel(2)).toBe(6);
    expect(maxHpForLevel(6)).toBe(10);
    expect(maxHpForLevel(7)).toBe(10);
  });

  it('stays within 5 to 10 for Levels 1 through 20 (invariant 3)', () => {
    for (let level = 1; level <= 20; level++) {
      expect(maxHpForLevel(level)).toBeGreaterThanOrEqual(5);
      expect(maxHpForLevel(level)).toBeLessThanOrEqual(10);
    }
  });
});

describe('titleForLevel', () => {
  it('is Apprentice for 1 to 3, Adept for 4 to 6, Wizard from 7', () => {
    expect([1, 3, 4, 6, 7, 12].map(titleForLevel)).toEqual([
      'Apprentice', 'Apprentice', 'Adept', 'Adept', 'Wizard', 'Wizard',
    ]);
  });
});

describe('encounterXp', () => {
  it('is damage dealt plus the monster max HP on a win, without overkill', () => {
    let e = startEncounter(spec, 5, NOW);
    for (let i = 0; i < 3; i++) e = castSpell(e, spell(), T, NOW); // 3 Critical Hits, 6 damage
    expect(e.status).toBe('won');
    expect(encounterXp(e)).toBe(6 + 6);
    let over = startEncounter({ ...spec, monsterMaxHp: 3 }, 5, NOW);
    over = castSpell(over, spell(), T, NOW);
    over = castSpell(over, spell(), T, NOW); // 4 rolled, 3 dealt
    expect(encounterXp(over)).toBe(3 + 3);
  });

  it('keeps every XP point on Retreat: damage dealt, no bonus (invariant 2)', () => {
    let e = startEncounter(spec, 2, NOW);
    e = castSpell(e, spell({ durationMs: 5000 }), T, NOW); // Hit, 1
    e = castSpell(e, spell({ correct: false }), T, NOW);
    e = castSpell(e, spell({ correct: false }), T, NOW);
    expect(e.status).toBe('retreated');
    expect(encounterXp(e)).toBe(1);
  });

  it('is 0 for an active Encounter with no damage yet', () => {
    expect(encounterXp(startEncounter(spec, 5, NOW))).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/character.test.ts`
Expected: FAIL, cannot resolve `./character`.

- [ ] **Step 3: Implement**

`src/engine/character.ts`:
```ts
import type { Encounter } from './combat';

// Cumulative XP to reach Level 2, 3, ... Content: retune here, nowhere else.
export const LEVEL_XP = [20, 50, 100, 180, 300, 480, 750, 1150, 1750];
const BASE_HP = 5;
const HP_CAP = 10;

export type Title = 'Apprentice' | 'Adept' | 'Wizard';

export const levelForXp = (xp: number): number => 1 + LEVEL_XP.filter((threshold) => xp >= threshold).length;

export const maxHpForLevel = (level: number): number => Math.min(HP_CAP, BASE_HP + level - 1);

export const titleForLevel = (level: number): Title => (level >= 7 ? 'Wizard' : level >= 4 ? 'Adept' : 'Apprentice');

// Damage dealt is measured on the monster, so overkill never pays.
export const encounterXp = (e: Encounter): number =>
  e.spec.monsterMaxHp - e.monsterHp + (e.status === 'won' ? e.spec.monsterMaxHp : 0);
```

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/engine/character.test.ts && npm test && npm run typecheck`
Expected: 8 tests pass in the file; suite green (55 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/character.ts src/engine/character.test.ts
git commit -m "feat: XP, Level, Title, and Encounter XP"
```

---

### Task 4: Save data version 2 with Encounter records

**Files:**
- Modify: `src/storage/save.ts`, `src/storage/save.test.ts`

**Interfaces:**
- Consumes: `Encounter` and `resolveSpell` from `combat.ts`; `encounterXp` from `character.ts`; `TIMES_TABLE_THRESHOLD_MS` from `mastery.ts`; `Attempt` from `types.ts`.
- Produces: `interface EncounterRecord { id: string; questId: string; monsterId: string; monsterMaxHp: number; startedAt: string; endedAt: string; status: 'won' | 'retreated'; xp: number; loot: string | null }`; `interface SaveData { version: 2; playerId: string; character: { xp: number }; attempts: Attempt[]; encounters: EncounterRecord[] }`; `withEncounter(data: SaveData, encounter: Encounter, loot: string | null, now: Date): SaveData`; `migrate` accepts version 1 and 2.

- [ ] **Step 1: Write the failing tests**

Replace `src/storage/save.test.ts` with:
```ts
import { describe, expect, it } from 'vitest';
import { emptySave, memoryStore, migrate, withAttempt, withEncounter } from './save';
import { castSpell, startEncounter, type EncounterSpec, type SpellInput } from '../engine/combat';
import type { Attempt } from '../engine/types';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const LATER = new Date('2026-09-16T12:05:00.000Z');
const attempt: Attempt = {
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500,
  at: '2026-09-15T12:00:00.000Z', encounterId: 'e1', outcome: 'critical',
};
const spec: EncounterSpec = { id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 2 };
const spell = (over: Partial<SpellInput> = {}): SpellInput => ({
  factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 2000, ...over,
});

describe('save data', () => {
  it('starts empty for a Player', () => {
    expect(emptySave('noah')).toEqual({
      version: 2, playerId: 'noah', character: { xp: 0 }, attempts: [], encounters: [],
    });
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

describe('withEncounter', () => {
  it('records a won Encounter with its XP and Loot and adds the XP to the Character', () => {
    const won = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW); // Critical, 2 damage
    const data = withEncounter(emptySave('noah'), won, 'hat', LATER);
    expect(data.encounters).toEqual([{
      id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 2,
      startedAt: NOW.toISOString(), endedAt: LATER.toISOString(), status: 'won', xp: 4, loot: 'hat',
    }]);
    expect(data.character.xp).toBe(4);
  });

  it('keeps XP from a Retreat and records no Loot', () => {
    let e = startEncounter(spec, 1, NOW);
    e = castSpell(e, spell({ durationMs: 5000 }), 4000, NOW); // Hit, 1
    e = castSpell(e, spell({ correct: false }), 4000, NOW);
    const data = withEncounter({ ...emptySave('noah'), character: { xp: 10 } }, e, null, LATER);
    expect(data.encounters[0]).toMatchObject({ status: 'retreated', xp: 1, loot: null });
    expect(data.character.xp).toBe(11);
  });

  it('throws for an active Encounter', () => {
    expect(() => withEncounter(emptySave('noah'), startEncounter(spec, 5, NOW), null, LATER))
      .toThrow('Encounter e1 is still active');
  });
});

describe('migrate', () => {
  it('returns a version-2 save unchanged', () => {
    const data = emptySave('noah');
    expect(migrate(data)).toEqual(data);
  });

  it('upgrades a version-1 save: XP 0, no Encounters, every Attempt gets an outcome (invariant 6)', () => {
    const v1 = {
      version: 1, playerId: 'noah',
      attempts: [
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-15T12:00:00.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 5000, at: '2026-09-15T12:00:05.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 13, correct: false, durationMs: 1500, at: '2026-09-15T12:00:10.000Z', encounterId: 'e1' },
      ],
    };
    const data = migrate(v1);
    expect(data.version).toBe(2);
    expect(data.character).toEqual({ xp: 0 });
    expect(data.encounters).toEqual([]);
    expect(data.attempts.map((a) => a.outcome)).toEqual(['critical', 'hit', 'miss']);
    expect(data.attempts[0]).toMatchObject(v1.attempts[0]!);
  });

  it('throws on an unsupported version', () => {
    expect(() => migrate({ version: 3 })).toThrow('Unsupported save version: 3');
    expect(() => migrate(null)).toThrow('Unsupported save version: undefined');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/storage/save.test.ts`
Expected: FAIL, `withEncounter` is not exported; `emptySave` shape mismatch.

- [ ] **Step 3: Implement**

Replace `src/storage/save.ts` with:
```ts
import { get, set } from 'idb-keyval';
import { encounterXp } from '../engine/character';
import { resolveSpell, type Encounter } from '../engine/combat';
import { TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import type { Attempt } from '../engine/types';

export interface EncounterRecord {
  id: string;
  questId: string;
  monsterId: string;
  monsterMaxHp: number;
  startedAt: string;
  endedAt: string;
  status: 'won' | 'retreated';
  xp: number;
  loot: string | null;
}

export interface SaveData {
  version: 2;
  playerId: string;
  character: { xp: number };
  attempts: Attempt[];
  encounters: EncounterRecord[];
}

interface SaveV1 {
  version: 1;
  playerId: string;
  attempts: Omit<Attempt, 'outcome'>[];
}

export interface Store {
  load(): Promise<SaveData | undefined>;
  save(data: SaveData): Promise<void>;
}

// The only copy of the Player's history lives in this blob (ADR-0001); every schema change lands here as a version bump plus a step in migrate.
export function migrate(raw: unknown): SaveData {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 2) return raw as SaveData;
  if (version === 1) {
    const old = raw as SaveV1;
    // v1 only ever held times-table Attempts, which have no Work.
    const attempts = old.attempts.map((a) => ({
      ...a, outcome: resolveSpell({ ...a, workCorrect: true }, TIMES_TABLE_THRESHOLD_MS),
    }));
    return { version: 2, playerId: old.playerId, character: { xp: 0 }, attempts, encounters: [] };
  }
  throw new Error(`Unsupported save version: ${String(version)}`);
}

export const emptySave = (playerId: string): SaveData => ({
  version: 2, playerId, character: { xp: 0 }, attempts: [], encounters: [],
});

export const withAttempt = (data: SaveData, attempt: Attempt): SaveData => ({
  ...data,
  attempts: [...data.attempts, attempt],
});

export function withEncounter(data: SaveData, encounter: Encounter, loot: string | null, now: Date): SaveData {
  if (encounter.status === 'active') throw new Error(`Encounter ${encounter.spec.id} is still active`);
  const xp = encounterXp(encounter);
  const record: EncounterRecord = {
    ...encounter.spec, startedAt: encounter.startedAt, endedAt: now.toISOString(), status: encounter.status, xp, loot,
  };
  return { ...data, character: { xp: data.character.xp + xp }, encounters: [...data.encounters, record] };
}

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
    load: async () => {
      const raw = await get<unknown>(key);
      return raw === undefined ? undefined : migrate(raw);
    },
    save: (data) => set(key, data),
  };
}
```

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/storage/save.test.ts && npm test && npm run typecheck`
Expected: 9 tests pass in the file; suite green (59 tests); typecheck clean.

- [ ] **Step 5: Commit and push, then check the deploy**

```bash
git add src/storage/save.ts src/storage/save.test.ts
git commit -m "feat: save data v2 with Encounter records and Character XP"
git push
gh run watch
```
Expected: build and deploy green.

---

## Out of scope for this plan (next plans)

1. **Achievements and Free Roam**: pure derivations over `SaveData.encounters` and `attempts`.
2. **Screens**: Character creation (name and portrait land in `SaveData.character` as version 3), title, Encounter with keypad, Map, trophy case, Guide screen.
3. **Work skills** and the Glancing Blow's real callers.
4. **Quest 1 content**: `EncounterSpec` lists and Loot pools as TypeScript data modules.
