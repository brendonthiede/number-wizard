# Number Wizard: write a Learning Plan from this Export

You are helping the Guide (a parent) of one child who plays Number Wizard, a maths game wrapped in
a fantasy adventure. The Player casts Spells by answering multiplication Problems, and the game
records every Attempt. The game never calls a model: the Guide brings you an Export, you advise, the
Guide decides and imports the plan. Read the Export at the end of this message and propose a
Learning Plan.

## How to read the Export

The Export is `{ "kind": "number-wizard-export", "exportedAt": ..., "save": { ... } }`. Inside
`save`:

- `attempts`: every Attempt, oldest first. Each has `factId`, `answer` (null when nothing was
  entered), `correct`, `durationMs` (from seeing the Problem to casting, including typing),
  `at` (ISO time), `encounterId`, and `outcome`: `critical` (correct and fast), `hit` (correct but
  slow), `glancing` (right answer, wrong Work) or `miss` (wrong). A grid Attempt also carries
  `operands`, `work` (the partial products entered, in order, null for an empty cell) and
  `labelsShown` (whether the Work labels were visible).
- `encounters`: every fight, with `questId`, `monsterId`, `status` (`won` or `retreated`), `xp`
  and the `startedAt` and `endedAt` times. Quest ids: `fortress-of-twelves` (the times table) and
  `golem-foundry` (multi-digit multiplication). `survival` marks a timed run.
- `character`: `name`, `xp` and `survivalBest`. `learningPlan`: the plan in force, or null. Start
  from it when it exists.
- `settings.hideWorkLabels`: whether the Player has chosen to hide the Work labels on the grid.

Facts and how they are Mastered:

- A times-table Fact is a pair, `tt:AxB` with A ≤ B, both 0 to 12: 91 Facts. Rows open in the order
  0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12, two at a time. A Fact is Mastered after its last three
  Attempts were correct, Work-correct and faster than the threshold, 4000 ms unless the plan says
  otherwise. Rows 0 and 1 need one such Attempt. One miss, one slow answer or one Glancing Blow sends
  it back to Learning, and a Mastered Fact comes back for Review after 1, 3, 7, 14 then 30 days.
- Multi-digit multiplication has three Tiers, each a Fact of its own: `md:2x1` (a two-digit by a
  one-digit number, threshold 20000 ms), `md:3x1` (30000 ms) and `md:2x2` (45000 ms). Each opens
  when the one before is Mastered, and a Tier needs five fast, correct, Work-correct Attempts in a
  row. The Player types every partial product, so the clock covers the whole grid.
- A Glancing Blow never counts toward Mastery: the answer was right but some Work was wrong.

## The plan you can write

The plan is JSON of this exact shape. Every key except `kind` and `version` is optional, and the
game rejects the whole plan if any value is out of range or any other key is present.

```json
{
  "kind": "number-wizard-learning-plan",
  "version": 1,
  "unlockedSkills": ["multi-digit-multiplication"],
  "emphasize": ["tt:7x8", "tt:6x9"],
  "thresholds": { "times-table": 5000, "md:2x1": 25000 },
  "monsterHpScale": 1,
  "problems": [[7, 8], [6, 9], [8, 9]],
  "note": "Sevens and eights are slow but accurate: a slightly looser threshold and extra practice on 7x8 and 6x9."
}
```

- `unlockedSkills`: Skill ids from `times-table`, `multi-digit-multiplication`, `powers`,
  `long-division`. Listing `multi-digit-multiplication` opens Quest 2 before Quest 1 is finished.
  Only `times-table` and `multi-digit-multiplication` have content today.
- `emphasize`: times-table Fact ids such as `tt:7x8` (smaller operand first). Each is served about
  three times as often. Use it for Facts that are shaky, not for every weak one at once.
- `thresholds`: `times-table` from 1000 to 60000 ms; `md:2x1`, `md:3x1` and `md:2x2` each from
  5000 to 180000 ms. Loosen when accurate answers are just too slow to Master; tighten when nearly
  every answer is a Critical Hit. This also sets what counts as a Critical Hit.
- `monsterHpScale`: 0.5 to 3. Below 1 makes fights shorter; above 1 longer. Quest 2 monsters have
  4 to 8 HP and a grid Spell takes far longer than a table Spell, so scale it with care.
- `problems`: at most 50 pairs of whole numbers 0 to 12, served first in this order, each once. A
  targeted drill; the game returns to normal selection when they are used up.
- `note`: at most 2000 characters. The Guide sees it on the Guide screen after Import, so put your
  reasoning here in plain words.

Never write story, monsters, Quests or any key not listed above.

## What to reply

1. A short summary for the Guide in plain words: what the history shows (what is Mastered, what is
   slow, what is missed, how much play there was and when), what you changed and why, and anything
   worth watching next time. Keep it to a few short paragraphs.
2. Then the Learning Plan JSON in one code block, valid as written, with the same reasoning in
   its `note`.

Change nothing the history does not support. If the current plan is working, say so and return it
with only the note updated. If there is too little history to judge, say that and return a plan
with only `kind`, `version` and a `note`.

## The Export

