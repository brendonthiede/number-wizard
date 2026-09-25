# Number Wizard: design decisions

Everything settled in the design interview of 2026-09-15. Vocabulary is in `CONTEXT.md`; lasting
trade-offs are in `docs/adr/`. This file holds the concrete rules and numbers. Numbers marked
*content* live in Quest data, not code.

## Player and platform

- One Player: Noah, 10, homeschooled, dyslexic, reads graphic novels well, math at or above grade.
  Data is keyed by Player id from day one; a Character select screen comes when a second Player exists.
- Browser web app on a touch Chromebook or tablet. Installable PWA so it works offline.
- Reading load: comic panels, at most two sentences each. Lexend body font, large, wide spacing.
  Every state change is shown visually, never text-only.
- Input: on-screen keypad with big keys, always visible, plus hardware keyboard. No multiple choice.

## Skills

Chain, in order: multiplication table (0 to 12) → multi-digit multiplication → powers and
exponents → long division with remainders. A Skill unlocks only through the Learning Plan; the game
flags a Skill *Ready* at 80% of Facts Mastered. Never re-locked.

### Facts and Tiers

- Multiplication table: 91 commutative Facts. Rows are introduced easy-first
  (0, 1, 2, 10, 5, 11, 3, 4, 6, 7, 8, 9, 12), at most two rows in Learning at once; the next row
  opens when current rows are 80% Mastered. Learning Plan emphasis overrides the order.
- Multi-digit multiplication Tiers: 2×1, 3×1, 2×2, 3×2, 3×3 digits. All operands allowed.
- Powers Tiers: squares to 12², cubes to 12³, powers of 2 to 2¹⁰, powers of 10 to 10⁶, and any base
  0 to 12 with exponent 0 to 3. Exponents 0 and 1 appear at the same rate as the rest.
- Long division Tiers: 2÷1, 3÷1, 4÷1, 3÷2, 4÷2 digits. About 70% of Problems have a nonzero remainder.

### Mastery and Review

- Mastered: last three Attempts correct, with all Work correct, and each under the speed threshold
  (4 s for the table; per Tier elsewhere, e.g. 60 s for 2×2 digits). One wrong, slow, or Glancing
  Blow Attempt returns the Fact to Learning: attention to detail is part of mastery (issue #1).
  Rows 0 and 1 of the table are warm-up rows: one fast correct Attempt masters a Fact there, since
  0 × n and 1 × n are rules, not facts to memorise.
- Spaced repetition per Fact: due 1, 3, 7, 14, 30 days after each correct Attempt, reset on a Miss.
  Dates use the device's local clock.
- Problem selection inside an Encounter, in priority: Learning Plan explicit Problems → Due Facts →
  Learning Facts weighted toward recent Misses → one in five from Mastered Facts at random.
  No Fact repeats within an Encounter unless nothing else is available.

### Work

- Multiplication: standard vertical algorithm, one partial-product row per digit of the bottom
  number, then a sum row. Box method is a possible later layout.
- Long division: standard bracket; the UI draws cells for each divide-multiply-subtract-bring-down
  cycle, the Player fills numbers only. Remainder is a separate field.
- Single submit, one Attempt per Problem, no retry. Every cell is recorded in the Attempt.
- After a Miss the correct answer and Work are shown for a few seconds with wrong cells marked.

## Adventure

- Character: name plus one of three pre-generated wizard portraits. No classes, no stats.
- Encounter: each Problem is a Spell. Monster HP is *content* (6 for early Encounters, up to 15 for a
  boss). Character HP starts at 5 and gains 1 per Level to a cap of 10.
- Outcomes: Hit = 1 damage; Critical Hit (correct and under the speed threshold) = 2; Glancing Blow
  (final correct, some Work wrong) = half, rounded down, minimum 1 on the first; Miss = Character
  loses 1 HP. Slow answers are never punished beyond losing the Critical.
- No visible timer. The clock runs silently; the Critical is revealed after the answer. The one
  exception is Survival: a five-minute run of back-to-back Encounters with a visible m:ss countdown,
  scored by Encounters won; the fight open at the buzzer ends as a Retreat, and the best score is
  kept on the Character.
- Retreat at 0 HP: keep all XP earned, monster heals. Nothing is ever lost.
- XP = damage dealt plus an Encounter-win bonus. Level thresholds grow roughly geometrically.
  Titles per Level band: Apprentice, Adept, Wizard (extend as needed).
- Loot: each monster drops its own Loot (*content*) per Encounter won; a boss holds two and gives the one not yet owned first. Cosmetic only.
- Achievements: first Hit; first Critical Hit; 5 Critical Hits in one Encounter; each table row
  Mastered (13); a whole Skill Mastered; first Quest completed; an Encounter won with no Miss.
  Nothing tied to days or streaks.
- Map fills one region per completed Quest. Regions whose Skill is locked are Fogged with a
  "the Guide holds the key" line. Completed regions offer Free Roam Encounters.
- Story: light and silly with a real arc. Pun monsters (Gob-nine, Twelve-Headed Hydra). Campaign is
  linear and hand-authored by Brendon and Claude, committed as TypeScript data modules.
- Quest 1, "The Fortress of Twelves": six Encounters plus a boss, a story panel before each Encounter
  and one after the boss, monster HP 6 rising to 15, a Loot pool of about 8. Written after the engine
  has passing tests.

## Art and sound

- Images are AI-generated: Claude Code writes the prompt, Brendon pastes it into ChatGPT, the file is
  committed. `docs/art-style.md` holds the shared style paragraph and specs: backgrounds 16:9;
  monsters and Characters square on a plain flat background, displayed inside a framed panel.
  Style: flat cartoon, bold outlines, bright palette, graphic-novel panels. Generate three images
  first (background, monster, Character) and revise the guide before doing more.
- Sound effects: Hit, Critical Hit, Glancing Blow, Miss, Level up, Loot drop. Music: title loop,
  battle loop, victory sting. All from CC0 or CC-BY sources with an attribution file. Two toggles
  (music, effects), remembered between sessions, no sliders. Music starts on first tap.
  2026-09-25: the six effects are synthesised with the Web Audio API (`src/ui/sound.ts`), so no
  files or attribution; music is deferred until tracks exist, and its toggle ships greyed. The
  toggles live in localStorage, a device preference outside the save.

## Guide loop

- Export: a JSON download (with copy-to-clipboard fallback) of every Attempt with timestamps, its
  Encounter, and Character state.
- Prompt template (2026-09-25): `docs/guide/learning-plan-prompt.md`, copied with the Export by the
  Guide screen's Copy Prompt button, asks a model for a summary and a version 1 plan.
- Learning Plan import: versioned JSON with unlocked Skills, Facts or Tiers to emphasise, speed
  threshold overrides, default monster HP scale, explicit Problems to serve, and a free-text note
  the game ignores.
- Guide screen behind a gear icon on the title screen: Export, Import, Reset (with confirmation).
  No password.

## Stack

- Vite, TypeScript, React. Static site on GitHub Pages at the default github.io URL, deployed by a
  GitHub Action on push to main. IndexedDB behind a thin storage wrapper.
- TDD throughout. Vitest for the math engine, Work checkers, scheduler, and any component that
  branches (keypad, Work grid, Encounter screen) via Testing Library. Purely presentational
  components are untested. No end-to-end tests in v1.
