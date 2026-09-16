# Screens, first playable slice: design

Settled 2026-09-16. Rules from `docs/design.md` (Player and platform, Adventure); vocabulary from
`CONTEXT.md`; engine interfaces from `docs/superpowers/specs/2026-09-16-encounter-and-combat-design.md`.

## Scope

The first thing the Player can play: title screen, Character creation, an Encounter screen with an
on-screen keypad against Gob-nine, and the Encounter end. Times-table Problems only.

Deferred: Map, trophy case, Guide screen (Export, Import, Reset), PWA, sound and music, Work grids,
Loot display, Character select for a second Player.

## Layers

- `src/game/play.ts`: pure orchestration over the engine. No React, no I/O, clock and RNG injected.
- `src/content/`: hand-authored data as TypeScript modules. Quest 1 placeholder with one Encounter
  template; the three portrait ids; the Player id.
- `src/ui/`: React screens and components. Plain CSS in one stylesheet with CSS variables. Lexend
  served from `public/fonts/`. Components receive data and callbacks; `App` owns state.

## Rules

### Play loop (`play.ts`)

- `beginEncounter(save, template, now)`: builds an `EncounterSpec` from the template with a fresh
  id (`crypto.randomUUID()`), starts it at `maxHpForLevel(levelForXp(save.character.xp))`, and
  returns `{ save, encounter }` with the Encounter stored as `activeEncounter`.
- `nextProblem(save, encounter, now, rng)`: `statusByFact` over `save.attempts`, `introducedRows`,
  `buildPools` with `inRows` eligibility, `pickFact` with weights from `factWeight` (no emphasis
  yet) and `servedFacts(encounter)`, then `timesTableProblem`. Never null: 91 Facts and the
  exhausted-pool fallback guarantee it.
- `cast(save, encounter, problem, answer, durationMs, now, rng)`: `castSpell` with Work correct
  (times table has no Work), `withAttempt`, then either `withActiveEncounter` (still active) or
  `rollLoot` from the template's pool and `withEncounter` (finished). Returns
  `{ save, encounter, outcome }`.
- `levelUp(before, after)`: true when `levelForXp` grew. Used by the result screen.

### Save data version 3

- `character` becomes `{ name: string; portrait: string; xp: number }`.
- Migration from v2 fills `name: ''` and `portrait: PORTRAITS[0]`. `migrate` validates `name` and
  `portrait` are strings. `emptySave` starts with an empty name.
- A Character exists when `name` is non-empty. The create screen shows until then.

### Screens and flow

`App` holds `save: SaveData | null` and `screen: 'title' | 'create' | 'encounter' | 'result'`.
On mount it loads from the injected `Store`; a missing save becomes `emptySave(PLAYER_ID)`. Every
state change that produces a new `save` is written through `store.save` (errors logged, never
thrown to the Player). Flow:

- No Character name → create. Otherwise → title.
- Title: "Number Wizard", the Character's portrait, name, and Title. One button: "Play", or
  "Continue" when `activeEncounter` is non-null (it resumes that Encounter).
- Create: name input (max 20 characters), three portrait cards, "Begin" enabled only when the name
  is non-empty and a portrait is selected. Begin writes the Character and goes to the title.
- Encounter: see layout below. Each Problem starts a silent clock. Cast is enabled only with a
  non-empty answer. After a cast the feedback banner shows for `FEEDBACK_MS` (1500 for a Hit or
  Critical Hit, 3000 for a Miss, which also shows the correct answer), input is disabled, then the
  next Problem appears or the screen goes to result when the Encounter finished.
- Result: won → "Victory!", XP earned, Level and Title, and a "Level up!" banner when
  `levelUp`. Retreated → "You retreat to fight another day.", XP kept. Buttons: "Fight again"
  (new Encounter from the same template) and "Title".

### Encounter layout

Landscape (Chromebook) with the keypad beside the panel; stacked below about 700 px wide.

```
┌───────────────────────────────────────────────────────────┐
│ [portrait] Noah  ♥♥♥♥♥              Gob-nine  ▮▮▮▮▮▮      │
│ ┌──────────────────────────────┐   ┌───┬───┬───┐          │
│ │ castle-02 background         │   │ 7 │ 8 │ 9 │   ⌫      │
│ │        [ Gob-nine art ]      │   │ 4 │ 5 │ 6 │          │
│ │                              │   │ 1 │ 2 │ 3 │  CAST    │
│ └──────────────────────────────┘   │   │ 0 │   │          │
│            7 × 8 = 5▮              └───┴───┴───┘          │
└───────────────────────────────────────────────────────────┘
```

- Hearts are the Character's HP out of max; pips are the monster's HP out of max. Both are
  `aria-label`led with the numbers.
- Keys are at least 64 px square. Hardware keys: digits, Backspace, Enter. Answer capped at
  4 digits.
- Feedback banner text: "Critical Hit!", "Hit!", "Miss. 7 × 8 = 56". Glancing Blow cannot occur
  yet but renders as "Glancing Blow!" if it does.
- Art: `art/background/castle-02.png` as the panel background, `art/monster/gob-nine.png` centred,
  portraits from `art/character/`. Paths resolve under Vite's `import.meta.env.BASE_URL`.

### Content

- `PLAYER_ID = 'noah'`.
- `PORTRAITS = ['character-01', 'character-02', 'character-03']`.
- `QUEST_1_FIRST: EncounterTemplate = { questId: 'fortress-of-twelves', monsterId: 'gob-nine',
  monsterName: 'Gob-nine', monsterMaxHp: 6, lootPool: [] }`.

### Font

Lexend Regular and Bold as woff2 under `public/fonts/`, declared with `@font-face` and a system
sans-serif fallback. Body 20 px, letter-spacing 0.02 em, line-height 1.5.

## Interfaces

`src/game/play.ts`

```ts
export interface EncounterTemplate { questId: string; monsterId: string; monsterName: string; monsterMaxHp: number; lootPool: string[] }
export function beginEncounter(save: SaveData, template: EncounterTemplate, now: Date): { save: SaveData; encounter: Encounter };
export function nextProblem(save: SaveData, encounter: Encounter, now: Date, rng?: () => number): Problem;
export function cast(save: SaveData, encounter: Encounter, problem: Problem, answer: number | null, durationMs: number, now: Date, rng?: () => number): { save: SaveData; encounter: Encounter; outcome: Outcome };
export function levelUp(before: SaveData, after: SaveData): boolean;
```

`src/storage/save.ts` (version 3)

```ts
export interface SaveData { version: 3; playerId: string; character: { name: string; portrait: string; xp: number }; attempts: Attempt[]; encounters: EncounterRecord[]; activeEncounter: Encounter | null }
export function withCharacter(data: SaveData, name: string, portrait: string): SaveData;
```

`src/ui/` components (props only, no context)

```ts
Keypad({ value, onChange, onCast, disabled })
HpHearts({ hp, maxHp })  MonsterPips({ hp, maxHp })
TitleScreen({ save, onPlay })
CreateScreen({ onBegin: (name, portrait) => void })
EncounterScreen({ save, encounter, template, onFinish: (save, encounter, xpBefore) => void, onSave: (save) => void, now?: () => Date, rng?: () => number })
ResultScreen({ save, encounter, xpBefore, onAgain, onTitle })
App({ store })
```

## Testing

Vitest. Engine and `play.ts` under node; component files opt into jsdom with a
`// @vitest-environment jsdom` header and Testing Library. Presentational components (hearts,
pips, title screen) are untested.

Invariants written from the design, not the plan:

1. Through `play.ts` alone, a 100-Encounter playthrough keeps `character.xp` equal to the sum of
   `encounters[].xp`, every Attempt's `encounterId` resolves, and `nextProblem` never repeats a
   Fact within an Encounter while unserved Facts remain.
2. `beginEncounter` always starts the Character at `maxHpForLevel(levelForXp(xp))`.
3. Migrating a v2 save yields a v3 save with an empty name and the first portrait; v1 still
   migrates.
4. The keypad never produces more than 4 digits or a leading zero beyond a lone 0.
5. The Encounter screen never accepts a cast while feedback is showing.
6. Loading a save with a non-null `activeEncounter` shows the Encounter screen, not the title.
