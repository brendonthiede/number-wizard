# Achievements and the Trophy Case: design

Settled 2026-09-17. Rules from `docs/design.md` (Adventure: Achievements); vocabulary from
`CONTEXT.md`.

## Scope

Achievements derived from the save, a reveal of newly earned ones after a fight, and a Trophy Case
screen that replaces the Loot screen and holds both the Loot grid and the Achievement list. No
new art; no save-shape change.

Deferred: Achievements for later Skills (they follow the same table); per-Achievement icons.

## The Achievements

Ids, names, and hints. Rows use the table's numbers. Nothing here depends on days or streaks.

| Id                    | Name                       | Hint (how to earn it)                                   | Earned when                                                        |
|-----------------------|----------------------------|---------------------------------------------------------|--------------------------------------------------------------------|
| `first-hit`           | First Hit                  | Land a Hit.                                             | first Attempt with outcome Hit or Critical Hit                     |
| `first-critical`      | First Critical Hit         | Answer fast enough for a Critical Hit.                  | first Attempt with outcome Critical Hit                            |
| `five-criticals`      | Five Criticals             | Land five Critical Hits in one Encounter.               | fifth Critical Hit within one Encounter id                         |
| `flawless-encounter`  | Flawless                   | Win an Encounter without a Miss.                        | a won record whose Attempts have no Miss                           |
| `row-<n>` (0 to 12)   | The Nines (etc.)           | Master the <n> times table row.                         | 11 of the row's 13 Facts Mastered                                  |
| `skill-times-table`   | Times Table Master         | Master every Fact in the multiplication table.          | all 91 Facts Mastered                                              |
| `first-quest`         | Fortress Taken             | Finish the Fortress of Twelves.                         | Quest 1 complete                                                   |

Row names: "The Zeros", "The Ones", "The Twos", "The Threes", "The Fours", "The Fives", "The
Sixes", "The Sevens", "The Eights", "The Nines", "The Tens", "The Elevens", "The Twelves".

Survival fights count toward the combat and mastery Achievements; only `first-quest` is Quest-bound.

## Rules

### Derivation

`achievements(save)` returns, for every Achievement in the table order, `{ id, name, hint, earnedAt }`
with `earnedAt` an ISO string or null. It is computed in one chronological pass over
`save.attempts` (combat and mastery Achievements, with per-Fact mastery recomputed for the Fact
just attempted, using the warm-up streak rule) plus `save.encounters` (`flawless-encounter`,
`first-quest`). `earnedAt` is the `at` of the Attempt, or the `endedAt` of the record, that first
satisfied the condition. Nothing is stored.

### Reveal

After a fight ends, the result screen (normal) and the Survival result screen list every
Achievement earned during that fight, each as one line "Achievement: First Hit" with role status,
under the Loot reveal (normal) or under the XP line (Survival). Computed by comparing
`achievements` before and after the fight (before is the save at Encounter start; App keeps it).

### Trophy Case

The title's "Loot" button becomes "Trophy Case". The screen shows a heading "Trophy Case", the
Loot grid as today with its count, then a heading "Achievements" with a count "N of 19" and the
list in table order: each row a medal glyph (gold when earned, grey outline otherwise), the name,
the hint, and for earned ones the date in the device's locale short form. "Title" stays focused.

## Interfaces

`src/game/achievements.ts`

```ts
export interface Achievement { id: string; name: string; hint: string; earnedAt: string | null }
export const ACHIEVEMENT_COUNT: number; // 19
export function achievements(save: SaveData): Achievement[];
export function newlyEarned(before: SaveData, after: SaveData): Achievement[];
```

`src/ui/TrophyCaseScreen.tsx` replaces `LootScreen.tsx` (same props: `{ save, onTitle }`).
`ResultScreen` and `SurvivalResultScreen` gain `earned?: Achievement[]`. `TitleScreen`'s `onLoot`
becomes `onTrophies` with the button text "Trophy Case". `App` keeps `saveBefore` for the reveal.

## Testing

Invariants written from the design:
1. `achievements(save)` has exactly 19 entries in table order for any save, and each `earnedAt`
   is null or an ISO timestamp not later than the latest Attempt or record.
2. Once earned, an Achievement stays earned: for any prefix of a save's history, the earned set is
   a subset of the full save's earned set, and `earnedAt` values agree.
3. A perfect Player who plays the Quest in order earns First Hit, First Critical Hit, Flawless,
   and Fortress Taken, in that order of `earnedAt`.
4. `five-criticals` needs five Critical Hits within a single Encounter id; five across two
   Encounters do not count.
5. `row-0` is earned after 11 of the row's Facts are Mastered under the warm-up rule (one fast
   correct Attempt each), and `skill-times-table` only when all 91 are Mastered.
6. `newlyEarned` after a fight lists exactly the ids whose `earnedAt` moved from null to a value.
7. The Trophy Case shows 19 rows with `achievements(save)` names, the earned ones with a date.
