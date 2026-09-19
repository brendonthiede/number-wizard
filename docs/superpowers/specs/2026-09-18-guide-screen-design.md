# Guide screen: Export, Import, Reset, and the Learning Plan: design

Settled 2026-09-18. Rules from `docs/design.md` (Guide loop), ADR-0001 (local-first) and ADR-0002
(no LLM at runtime); vocabulary from `CONTEXT.md`.

## Scope

The Guide screen behind a gear on the title: Export the save, Import a Learning Plan or an Export,
Reset. Learning Plan version 1 with the fields that have an effect today. Save data version 5.

Deferred: Skill locking and Fogged regions (`unlockedSkills` is accepted and kept, no effect);
Tier thresholds for later Skills; a password.

## Files

### Export

```json
{ "kind": "number-wizard-export", "exportedAt": "<ISO>", "save": { ...SaveData } }
```
The whole save: Attempts, Encounter records, Character, the live Encounter, the Learning Plan.
File name `number-wizard-<playerId>-<YYYY-MM-DD>.json`.

### Learning Plan, version 1

```json
{
  "kind": "number-wizard-learning-plan",
  "version": 1,
  "unlockedSkills": ["times-table"],
  "emphasize": ["tt:7x8", "tt:6x9"],
  "thresholds": { "times-table": 5000 },
  "monsterHpScale": 1,
  "problems": [[7, 8], [6, 9]],
  "note": "free text the game ignores"
}
```
Every field except `kind` and `version` is optional. Validation, all-or-nothing: `emphasize` ids
must be among the 91 generated table Fact ids; `thresholds["times-table"]` a finite number from
1000 to 60000; `monsterHpScale` a finite number from 0.5 to 3; `problems` pairs of integers 0 to
12, at most 50; `unlockedSkills` known Skill ids; `note` a string of at most 2000 characters;
unknown keys rejected. A rejected file changes nothing and reports the first problem in plain words.

## Rules

- **Threshold.** The plan's times-table threshold replaces 4000 ms for new Spells (Critical Hit),
  and for mastery, Due dates, and row introduction from the next computation. Stored `outcome`
  values are history and never recomputed.
- **Achievements.** Computed with the more lenient of 4000 ms and the plan's threshold, so a
  looser plan helps the Player earn them and a stricter plan never takes one away. Loosening a
  plan and later removing it can un-earn an Achievement earned under it; storing earned
  Achievements would need a save change and is deferred.
- **Emphasis.** Emphasised Facts get the existing `factWeight` emphasis (+2).
- **Monster HP scale.** Applied when an Encounter begins: `max(1, round(monsterMaxHp × scale))`.
  The scaled value is what the spec, the record, and XP use. Survival too.
- **Explicit Problems.** Served before Due Facts, in list order. An entry is used up once an
  Attempt on its Fact exists with `at` later than the plan's `importedAt`; the k-th repeat of a
  Fact needs k such Attempts. Derived, nothing stored. Operand order is the plan's, not random.
  The no-repeat-within-an-Encounter rule still applies; a blocked entry waits for the next one.
- **Import of an Export** replaces the whole save through `migrate` (so a corrupt or
  future-version file is rejected), behind the same confirmation as Reset. If the restored save's
  open Encounter names a quest or monster this build no longer has, it is closed as a Retreat
  (keeping its XP and Attempts) before the save reaches the screen, so Continue never crashes on it.
- **Reset** shows "This deletes all of <name>'s progress." with Cancel focused. The confirmation
  has its own "Download Export" button, and "Delete progress" stays disabled until a download has
  started without error: a browser download gives no completion signal, so downloading and deleting
  are two separate taps and the Guide is told to check the file. A failed download keeps it
  disabled. Every confirmation starts locked. Deleting replaces the save with
  `emptySave(PLAYER_ID)` and shows Character creation. Restoring an Export uses the same two steps.
- **Removing the plan** sets `learningPlan` to null. No confirmation.

## Save data version 5

`learningPlan: { plan: LearningPlan; importedAt: string } | null`. Version 4 migrates with null.
`migrate` validates the stored plan with the same parser; a bad plan is a corrupt save.

## Screen

Title gains a gear button (accessible name "Guide") in the top corner. The Guide screen:
- "Export": Download, and Copy (clipboard) as the fallback; a status line says which happened.
- "Import": a textarea "Paste a Learning Plan or an Export", a "Choose file" input that fills it,
  and an Import button. Status line: "Learning Plan imported.", "Save restored.", or the error.
- Current plan: the threshold, scale, counts of emphasised Facts and remaining explicit Problems,
  the note, and "Remove Learning Plan". "No Learning Plan." when null.
- "Reset" with the confirmation above. "Title" returns.
Plain adult-facing layout; the reading-load rules for the Player do not bind this screen.

## Interfaces

`src/game/learningPlan.ts`: `LearningPlan`, `StoredPlan`, `parseLearningPlan(raw: unknown):
LearningPlan` (throws `Error` with the plain message), `thresholdFor(save)`,
`achievementThresholdFor(save)`, `scaledHp(save, hp)`, `isEmphasized(save, factId)`,
`nextExplicitProblem(save, served: Set<FactId>): Problem | null`, `remainingExplicit(save): number`.

`src/game/exportFile.ts`: `buildExport(save, now)`, `exportFileName(save, now)`,
`parseImport(text): { kind: 'plan'; plan } | { kind: 'save'; save }` (throws with a plain message).

`src/storage/save.ts`: version 5, `withLearningPlan(data, plan, now)`, `withoutLearningPlan(data)`.

`src/game/play.ts` and `src/game/achievements.ts` read the plan through the helpers above.

`src/ui/GuideScreen.tsx`: `GuideScreen({ save, onSave, onReset, onTitle, now?, download?, copy? })`
with the two side effects injected for tests.

## Testing

Invariants written from the design:
1. `parseLearningPlan` accepts the example above and rejects each single violation with a message
   naming the field; a rejected import leaves the save identical.
2. `parseImport(JSON.stringify(buildExport(save, now)))` round-trips to an equal save.
3. With a threshold of 6000, a 5000 ms correct Attempt is a Critical Hit and counts toward
   mastery; without a plan it does neither.
4. A stricter plan never un-earns an Achievement: for any save, the earned set under a 2000 ms
   plan equals the earned set with no plan.
5. Explicit Problems are served first, in order, each once, across Encounters; after they are used
   up, selection is as before.
6. `scaledHp` is never below 1 and XP equals twice the scaled HP on a flawless win.
7. Reset and restore stay locked until an Export download has started, and Cancel changes nothing.
8. Migrating a version-4 save yields version 5 with a null plan; a save with a malformed plan is
   rejected as corrupt.
