# Encounter and combat engine: design

Settled 2026-09-16. Rules come from `docs/design.md` (Adventure section); vocabulary from
`CONTEXT.md`. This spec adds the numbers and interfaces the design left open.

## Scope

Pure engine only: Spell outcomes, the Encounter reducer, XP, Level, Title, a Loot roll, and the
save-data changes that record all of it. No UI, no Quest content.

Deferred to the next plan: Achievements and Free Roam. Both are derivations over the Encounter
records this plan stores.

## Rules

### Spell outcomes

| Outcome       | Condition                                              | Monster damage | Character HP |
| ------------- | ------------------------------------------------------ | -------------- | ------------ |
| Critical Hit  | correct, Work correct, duration under the threshold    | 2              | 0            |
| Hit           | correct, Work correct, duration at or over threshold   | 1              | 0            |
| Glancing Blow | correct final answer, some Work wrong (any speed)      | 1              | 0            |
| Miss          | incorrect final answer                                 | 0              | -1           |

The threshold is the Skill's speed threshold (4000 ms for the times table, the same one mastery
uses). Times-table Problems have no Work, so callers pass Work as correct and they never Glance.
A Glancing Blow is never a Critical. "Half a Hit, rounded down, minimum 1" always equals 1, so the
rule is stated as 1.

### Encounter

- An Encounter starts with the monster at its max HP (Quest content) and the Character at full
  max HP. HP never carries between Encounters.
- Each Spell is one Attempt. The Encounter ends `won` when monster HP reaches 0 and `retreated`
  when Character HP reaches 0. It is `active` otherwise.
- No Fact repeats within an Encounter unless nothing else is available. The engine exposes the set
  of Facts served so far; selection stays in `select.ts`.
- Retreat keeps every XP point earned. The monster heals (the next Encounter starts fresh).
- The live Encounter is persisted after every Spell so a reload resumes it; nothing is ever lost.

### XP, Level, Title

- Encounter XP = total damage dealt, plus the monster's max HP as a win bonus.
- Cumulative XP to reach each Level, from Level 2: 20, 50, 100, 180, 300, 480, 750, 1150, 1750.
  One content array; Levels past the array end are not reached.
- Max HP = 5 at Level 1, plus 1 per Level, capped at 10.
- Titles: Apprentice (Levels 1 to 3), Adept (4 to 6), Wizard (7 and up).

### Loot

One uniform random pick from the Quest's Loot pool (an array of ids) on a win. `null` on Retreat
or when the pool is empty. `withEncounter` is the enforcement point: it drops any Loot passed in
for a non-`won` Encounter.

## Interfaces

All in `src/engine/`, pure, no React or browser APIs, clock and RNG injected.

`combat.ts`

```ts
export type Outcome = 'critical' | 'hit' | 'glancing' | 'miss';
export interface SpellInput { factId: FactId; answer: number | null; correct: boolean; workCorrect: boolean; durationMs: number }
export interface EncounterSpec { id: string; questId: string; monsterId: string; monsterMaxHp: number }
export type EncounterStatus = 'active' | 'won' | 'retreated';
export interface Encounter { spec: EncounterSpec; monsterHp: number; characterHp: number; characterMaxHp: number; spells: Attempt[]; startedAt: string; status: EncounterStatus }

export function resolveSpell(input: SpellInput, thresholdMs: number): Outcome;
export function damageOf(outcome: Outcome): number;
export function startEncounter(spec: EncounterSpec, characterMaxHp: number, now: Date): Encounter;
export function castSpell(encounter: Encounter, input: SpellInput, thresholdMs: number, now: Date): Encounter;
export function servedFacts(encounter: Encounter): Set<FactId>;
export function rollLoot(pool: string[], rng?: () => number): string | null;
```

`castSpell` on a non-active Encounter throws; the UI never offers a Spell after the end.
`startEncounter` throws on non-positive `monsterMaxHp` or `characterMaxHp`, so a content typo
fails loudly instead of starting a dead Encounter.

`character.ts`

```ts
export const LEVEL_XP: number[];        // cumulative, index 0 is Level 2
export function levelForXp(xp: number): number;
export function maxHpForLevel(level: number): number;
export function titleForLevel(level: number): 'Apprentice' | 'Adept' | 'Wizard';
export function encounterXp(encounter: Encounter): number;
```

`types.ts`

- `Attempt` gains `outcome: Outcome`. It is the per-Spell record; there is no parallel spell list.

`storage/save.ts`, version 2

```ts
export interface EncounterRecord { id: string; questId: string; monsterId: string; monsterMaxHp: number; startedAt: string; endedAt: string; status: 'won' | 'retreated'; xp: number; loot: string | null }
export interface SaveData { version: 2; playerId: string; character: { xp: number }; attempts: Attempt[]; encounters: EncounterRecord[]; activeEncounter: Encounter | null }

export function withEncounter(data: SaveData, encounter: Encounter, loot: string | null): SaveData;
export function withActiveEncounter(data: SaveData, encounter: Encounter): SaveData;
```

`withEncounter` appends the record and adds its XP to `character.xp`, and clears `activeEncounter`
back to `null`. `endedAt` is the last Spell's `at`, never a call-time clock: a finished Encounter
always has at least one Spell. Attempts are appended per Spell with the existing `withAttempt`;
they link to the record by `encounterId`.

`withActiveEncounter` stores the in-progress Encounter as-is; the UI calls it after every
`castSpell`, alongside `withAttempt`, so a reload resumes an abandoned Encounter instead of
orphaning its Attempts or losing their XP.

Migration v1 to v2: add `character: { xp: 0 }`, `encounters: []`, and `activeEncounter: null`; set
each Attempt's `outcome` from `correct` and `durationMs` against the times-table threshold (the
only Skill v1 could hold). Character name and portrait are added by the screens plan.

`migrate` validates its input before trusting it: v2 passes through only if `attempts` and
`encounters` are arrays, `character.xp` is a number, and `activeEncounter` is an object or null;
v1 only if `attempts` is an array. Otherwise it throws `Corrupt save data (version <v>)`.
Unsupported versions still throw `Unsupported save version: <v>`.

## Testing

Vitest, node environment. Every module gets its rule tests plus these invariants written from
`docs/design.md`, not from the plan body:

1. An Encounter always ends within monster max HP plus Character max HP Spells, for any sequence of
   inputs.
2. Retreat keeps every XP point: `encounterXp` of a retreated Encounter equals damage dealt.
3. `maxHpForLevel` is within 5 to 10 for every Level 1 through 20.
4. `levelForXp` never decreases as XP grows.
5. A Glancing Blow never resolves as a Critical, for any duration.
6. Migrating a v1 save yields a v2 save whose Attempts all carry an outcome and whose XP is 0.
7. After any sequence of `withAttempt`/`withActiveEncounter`/`withEncounter` calls, every Attempt's
   `encounterId` resolves either to `activeEncounter.spec.id` or to an `encounters[]` record.
