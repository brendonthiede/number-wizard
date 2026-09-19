# Quest 2 and the Work grid: design

Settled 2026-09-18 with Brendon. Rules from `docs/design.md` and the Encounter and combat design
(Glancing Blow); vocabulary from `CONTEXT.md`. ADR-0001 holds: the save is the only copy of the
Player's history, so every new field loads from an older save.

## Scope

The second Skill, multi-digit multiplication, with three Tiers; the Work grid that collects partial
products; the first real Glancing Blows; Quest 2, The Golem Foundry; six Achievements; a plain
Quest list. Save data version 6.

Deferred: the Map with Fogged regions; grids in Survival (too slow for a five-minute clock);
Learning Plan emphasis and explicit Problems for Tiers; a 3×2 Tier; labels that fade on their own.

## Decisions Brendon made

| Question | Answer |
|---|---|
| Written method | Partial products: one Work cell per place-value product, then the answer |
| Tiers | 2×1, 3×1, 2×2, opened in order as the one before is Mastered |
| Speed thresholds | 20 s, 30 s, 45 s; the clock covers every cell plus the answer |
| What opens Quest 2 | Finishing Quest 1, or a Learning Plan that unlocks the Skill |
| Table Review inside Quest 2 | Mixed into each fight, one Spell in five |
| Work labels | Shown at first; the Player can hide them, hiding sticks as the default, and he is encouraged to |
| Cell order | Any order counts, always |
| Quest size | Same shape as Quest 1: seven Encounters, eight Loot, one Background |
| Attempts to master a Tier | Five fast, correct, Work-correct Attempts in a row |

## Engine

### Tiers (`src/engine/multiDigit.ts`, pure)

```ts
export const TierId = { TwoByOne: 'md:2x1', ThreeByOne: 'md:3x1', TwoByTwo: 'md:2x2' } as const;
export interface Tier extends Fact { skill: 'multi-digit-multiplication'; digits: [number, number]; thresholdMs: number }
export const TIERS: Tier[];                       // in opening order, thresholds 20000, 30000, 45000
export const TIER_MASTERY_STREAK = 5;
export function openTiers(status: Record<FactId, FactStatus>): Tier[];
export function multiDigitProblem(tier: Tier, rng?: () => number): Problem;
export function checkWork(expected: number[], entered: (number | null)[]): boolean[];
```

- A Tier is a Fact. A Tier is open when it is the first Tier, when the Tier before it is Mastered,
  or when it already has an Attempt. So once the Player has met a Tier it is never taken away, the
  same as table rows.
- Operands: the first has the Tier's first digit count, the second its second. Digits of the first
  are 1 to 9; digits of the second are 2 to 9. No zero digit, so every Work cell is a real table
  Fact times a power of ten. The prompt is `47 × 36`, first operand first.
- `Problem` gains two optional fields: `operands: [number, number]` and
  `work: { label: string; value: number }[]`. Cells run ones digit of the second operand first,
  and within it ones digit of the first operand first: for `47 × 36` the labels are `6 × 7`,
  `6 × 40`, `30 × 7`, `30 × 40`. Two, three and four cells for the three Tiers.
- `checkWork` treats the expected values as a multiset. Walking the entered cells in order, a cell
  is right when its value is still in the multiset, and that value is then used up. `null` (empty)
  is wrong. So any order of the right values is all right, a duplicate partial product (`33 × 33`
  has 90 twice) needs to appear twice, and a value entered twice is right once.
- Work is correct when every cell is right. A right answer with any wrong cell is a Glancing Blow:
  1 damage, never counts toward Mastery, at any speed. A wrong answer is a Miss whatever the Work.

### Mastery and thresholds

- `masteryStreakFor(id)` returns `TIER_MASTERY_STREAK` for a Tier id. Rows keep 1 and 3.
- The threshold becomes per Fact: `thresholdFor(save, factId)`. A table Fact uses the table
  threshold; a Tier uses its own. `statusByFact` takes the threshold as a function of the Fact id.
  `achievementThresholdFor(save, factId)` keeps its rule, the more lenient of the default and the
  plan's.
- Learning Plan `thresholds` may now also set `md:2x1`, `md:3x1` and `md:2x2`, each a finite
  number from 5000 to 180000 ms. The plan version stays 1: the change only accepts more.
- `unlockedSkills` now has an effect: listing `multi-digit-multiplication` opens Quest 2.

### Selection (`src/game/play.ts`)

`EncounterTemplate` gains `skill: SkillId`. `nextProblem` reads it:

1. An explicit Learning Plan Problem, if one is left (unchanged, any Quest).
2. In a multi-digit Encounter, with probability one in five, a table Problem picked exactly as
   today, but only when a table Fact is Due or in Learning within the introduced rows. Otherwise
   this step is skipped and the roll has no effect.
3. A Tier from `openTiers`, through the existing Due, Learning and Mastered pools, then
   `multiDigitProblem`. With so few Tiers the no-repeat rule runs out at once; `pickFact` already
   falls back to repeating in priority order.

Quest 1 and Survival Encounters carry `skill: 'times-table'` and behave as today.

`cast` takes the entered Work. `workCorrect` is every cell of `checkWork` right, or true when the
Problem has no Work.

## Save data, version 6

```ts
interface Attempt {            // three new optional fields, present only on a grid Attempt
  operands?: [number, number];
  work?: (number | null)[];    // as entered, in cell order
  labelsShown?: boolean;       // the labels were visible at any moment of this Problem
}
interface SaveData { version: 6; settings: { hideWorkLabels: boolean }; /* rest unchanged */ }
```

- `migrate` takes a version 5 save to 6 by adding `settings: { hideWorkLabels: false }`.
- `isAttempt` validates the optional fields when present: a pair of finite integers, an array of
  finite numbers or null, a boolean. A missing field is valid; old Attempts never gain them.
- The preference is stored, not derived, because a peek must not change it (below).

## Screens

### Work grid (`src/ui/WorkGrid.tsx`)

- The stacked Problem, one input per Work cell, a rule, and the answer input. The inputs are the
  same read-only, `inputMode="none"` inputs as `AnswerInput`, so hardware typing, Tab and the
  on-screen keypad all work.
- Focus starts on the first Work cell when the Problem appears (the standing rule: focus the first
  input as soon as combat begins). The keypad types into the focused cell. Tapping a cell focuses
  it. Enter in a Work cell moves to the next input; Enter in the answer casts. The keypad shows a
  Next key while a grid is up. The Next key wraps from the answer back to the first Work cell. A
  cell holds at most six digits.
- Cast needs only the answer. Empty Work cells are wrong cells.
- A table Problem inside Quest 2 shows the single answer box as today.

### Labels

- A button above the cells reads "Hide labels" or "Show labels".
- While `settings.hideWorkLabels` is false the labels start shown. Hiding them saves
  `hideWorkLabels: true` at once.
- While it is true the labels start hidden on every Problem. Showing them is a peek: it lasts for
  that Problem only and never changes the setting.
- The Attempt's `labelsShown` is true when the labels were visible at any moment of the Problem.

### Feedback

- A Hit or Critical Hit on a grid shows the banner and moves on after `FEEDBACK_MS.hit`.
- A Glancing Blow marks each wrong cell and shows the right value beside it. A Miss shows the full
  answer in the banner as today, and the grid shows the right Work. Both stay until the Player
  presses a focused "Next Problem" button, so there is time to read them.

### Quest list and result

- `questOpen(save, quest)`: Quest 1 is always open; Quest 2 is open when Quest 1 is complete or the
  Learning Plan unlocks its Skill.
- Play goes straight to Quest 1 while it is the only open Quest. Once Quest 2 is open, Play shows a
  Quest list: one button per open Quest, with its name. A resumed Encounter still resumes first.
- After a won Encounter with at least one grid Attempt where labels were shown and no Glancing
  Blow, the result screen adds: "All your Work was right. Try the next fight with the labels
  hidden!"

## Achievements

Six more, 25 in all, derived like the rest:

| id | Name | Earned when |
|---|---|---|
| `tier-md-2x1` | Two by One | the 2×1 Tier is first Mastered |
| `tier-md-3x1` | Three by One | the 3×1 Tier is first Mastered |
| `tier-md-2x2` | Two by Two | the 2×2 Tier is first Mastered |
| `skill-multi-digit` | Multiplication Master | all three Tiers are Mastered at once |
| `second-quest` | Foundry Cooled | the Golem Foundry's boss is first beaten |
| `no-labels` | No Labels | ten Encounters in a row are won with no label shown |

"No Labels" walks the Encounter records in order and looks only at Encounters with at least one
grid Attempt. A win with no `labelsShown` Attempt adds one to the run; a Retreat, or any label
shown, resets it. It is earned at the tenth win's `endedAt`.

## Content (`src/content/quest2.ts`)

The Golem Foundry, id `golem-foundry`, Background `foundry-01`, Skill multi-digit multiplication.
Its monsters are built from parts, the way an answer is built from partial products. HP runs lower
than Quest 1 because a grid Spell takes longer.

| # | id | Name | HP | Story Panel |
|---|---|---|---|---|
| 1 | `splitter-critter` | Splitter Critter | 4 | Below the Fortress an old foundry has started up by itself, and it is building monsters out of numbers. The first one splits in two when it sees you: a tens half and a ones half. |
| 2 | `tens-hen` | The Tens Hen | 4 | A clockwork hen struts along the conveyor belt laying eggs in stacks of ten. She counts them before they hatch. |
| 3 | `partial-parrot` | Partial Parrot | 5 | A brass parrot repeats only part of everything you say. "Products!" it squawks. |
| 4 | `zero-hero` | Zero the Hero | 5 | A small golem in a cape juggles zeros and sticks them on the end of every number he meets. He thinks that makes him ten times braver. |
| 5 | `hundred-pede` | The Hundred-Pede | 6 | Something with a hundred iron feet is marching round the furnace in step. It takes a while to turn around. |
| 6 | `sum-o` | Sum-o | 7 | A huge round golem stamps the floor and bows. He adds up everything he has eaten today, and it is a lot. |
| 7 | `grand-product` | The Grand Product | 8 | At the heart of the foundry stand four great blocks stacked into one giant. Every block is a piece of the answer. |

Closing: "The Grand Product comes apart into four tidy blocks and the furnace goes quiet. You knew
how to take a big number to pieces, and how to put it back."

Loot, eight new ids added to `LOOT`: `gear-goggles` Gear Goggles, `brick-boots` Brick Boots,
`ring-of-zeros` Ring of Zeros, `brass-feather-pen` Brass Feather Pen, `tens-egg-timer` Tens Egg
Timer, `foundry-apron` Foundry Apron, `splitting-wand` Splitting Wand, `golem-heart-lantern`
Golem-Heart Lantern. Quest 1 keeps its own eight as its pool; Quest 2's pool is these eight.

`QUESTS`, `findTemplate` and `SURVIVAL_QUEST_ID` stay in `src/content/quest1.ts`, which imports
`quest2.ts` for the registry; `quest2.ts` imports only types back, so there is no runtime cycle and
the 25 existing importers do not change. Survival's roster stays Quest 1.

Art: sixteen prompts added to `docs/art-style.md` in its format. Brendon generates them; masters go
in `art-src`, `scripts/shrink.py` builds the WebP. The art check test lists Quest 2's slugs as
expected only once their masters exist, so the branch is green before the art lands and strict
after.

## Glossary (`CONTEXT.md`)

- **Mastered** now says: three Attempts for a table Fact, five for a Tier.
- New: **Work grid**, the layout that collects Work cells and the answer. New: **Work label**, the
  small Problem shown beside a Work cell, which the Player can hide.

## Invariants (each gets a test derived from this design, not from the plan)

1. Any order of the right partial products is correct Work; a missing, extra-wrong or duplicated
   value is not.
2. A Glancing Blow never counts toward a Tier's Mastery, at any speed.
3. A Tier needs five fast, correct, Work-correct Attempts in a row; a table Fact still needs three.
4. A peek never changes `hideWorkLabels`; hiding always does.
5. `labelsShown` is true if the labels were visible at any moment, including a peek that was closed
   again before casting.
6. A version 5 save loads as version 6 with every Attempt unchanged; a version 6 save with grid
   Attempts survives Export and Import byte for byte.
7. Quest 1 and Survival never serve a grid. Quest 2 serves a table Problem only when one is Due or
   in Learning.
8. Focus is on the first Work cell when a grid appears, and on the answer box for a table Problem.
9. "No Labels" is reset by a Retreat and by a single peek, and ignores Encounters with no grid.
10. One integration test plays a whole Quest 2 fight through the real screens: grid, Glancing Blow
    feedback, a table Review Spell, the win, and the Loot.
