# Quest 1 content and Quest screen: design

Settled 2026-09-16. Rules from `docs/design.md` (Adventure; Quest 1 line); vocabulary from
`CONTEXT.md`; art rules from `docs/art-style.md`.

## Scope

The hand-authored content for Quest 1, "The Fortress of Twelves": seven Encounters (six plus a
boss), a story panel before each and one after the boss, and an eight-item Loot pool. The Quest
screen to move through them, the story panel screen, template resolution on resume, and Survival
walking the roster.

Deferred: Loot art and display, Achievements, Map, Free Roam, a second Quest.

## Content

Quest id `fortress-of-twelves`, name "The Fortress of Twelves", background `castle-02`.

| # | Slug                  | Name                    | HP | Story panel (before the fight)                                                                                    |
|---|-----------------------|-------------------------|----|-------------------------------------------------------------------------------------------------------------------|
| 1 | `gob-nine`            | Gob-nine                | 6  | The Twelve-Headed Hydra smashed the Fortress of Twelves and scattered the Great Times Table. A goblin with nine eyes guards the first stone. |
| 2 | `fourmidable-knight`  | The Fourmidable Knight  | 7  | A rusty knight blocks the path with four arms and four swords. He has never lost a fight, mostly because nobody can count his hits. |
| 3 | `spinner-six`         | Spinner Six             | 8  | A giant spider drops from the gate with only six legs. Do not mention the missing two.                            |
| 4 | `ate-bat`             | The Ate-Bat             | 10 | In the courtyard a fat bat with eight wings is eating numbers off the wall. It burps a seven.                    |
| 5 | `tenta-cool`          | Tenta-Cool              | 11 | A ten-armed squid in sunglasses lounges in the moat. It offers to fight you with one arm tied behind its back.   |
| 6 | `odd-owl`             | The Odd Owl             | 13 | High in the tower an owl hoots eleven times and glares at every even number. It has been waiting all night.      |
| 7 | `twelve-headed-hydra` | Twelve-Headed Hydra     | 15 | At the top, twelve heads argue about the answer to everything. They all turn to look at you at once.             |

Closing panel: "The Great Times Table is whole again and the Fortress lights up window by window.
The Hydra's heads agree on one thing: leave."

Loot pool (ids, names): `star-hat` Star Hat; `moon-hat` Moon Hat; `nine-eye-monocle` Nine-Eye
Monocle; `rusty-gauntlet` Rusty Gauntlet; `spider-silk-scarf` Spider-Silk Scarf; `bat-wing-cloak`
Bat-Wing Cloak; `ink-staff` Ink Staff; `owl-feather-quill` Owl Feather Quill. Every Encounter draws
from the whole pool.

Content rules, each with a test: HP climbs from 6 to 15 and never falls; every panel and the
closing panel is at most two sentences; slugs are unique; every template resolves by quest and
monster id.

## Rules

### Progress

Derived from `SaveData.encounters`, never stored: an Encounter is `won` when a record with status
won matches its quest id and monster id; `open` when it is the first Encounter not won; `locked`
otherwise. The Quest is complete when the boss is won. A won Encounter stays open to replay.

### Screens and flow

- Title "Play" opens the Quest screen; "Continue" still resumes the open Encounter directly.
- Quest screen: the Quest name, then the seven Encounters in order as buttons showing the monster
  name, its max HP as pips, and a state word: "Won", nothing for open, "Locked" (disabled). The
  first open row is focused; if the Quest is complete, the boss row is focused. A "Title" button.
- Story panel: the Quest background as the panel, the monster's art over it (hidden if the image
  fails to load), the panel text, and a focused "Fight" button. Fight begins that Encounter.
- After a won boss fight the result screen's primary button reads "Continue" and leads to the
  closing panel with a focused "Title" button; otherwise "Continue" returns to the Quest screen.
- The Encounter screen and result screen are unchanged except for the button label.

### Resume

App resolves the template for `save.activeEncounter.spec` through `findTemplate`. A saved spec
that resolves to nothing (a monster removed from content) shows the load-failure screen with the
same message; the blob is untouched.

### Survival

The run walks the roster: fight `n` (counting from 0) uses Encounter `n mod 7`. Everything else
about Survival is unchanged.

## Interfaces

`src/content/quest1.ts`

```ts
export interface StoryPanel { text: string }
export interface QuestEncounter extends EncounterTemplate { story: StoryPanel }
export interface Quest { id: string; name: string; background: string; lootPool: string[]; encounters: QuestEncounter[]; closing: StoryPanel }
export const LOOT: Record<string, string>; // id → name
export const QUEST_1: Quest;
export function findTemplate(questId: string, monsterId: string): QuestEncounter | null;
```

`src/content/index.ts` keeps `EncounterTemplate`, `PLAYER_ID`, `PORTRAITS`, `APP_TITLE`; `QUEST_1_FIRST` becomes `QUEST_1.encounters[0]` re-exported for existing callers.

`src/game/quest.ts`

```ts
export const EncounterState = { Locked: 'locked', Open: 'open', Won: 'won' } as const;
export type EncounterState = (typeof EncounterState)[keyof typeof EncounterState];
export function questProgress(save: SaveData, quest: Quest): EncounterState[]; // one per Encounter, in order
export function questComplete(save: SaveData, quest: Quest): boolean;
export function nextOpenIndex(save: SaveData, quest: Quest): number; // first open, or the last index when complete
```

`src/ui/`

```ts
QuestScreen({ save, quest, onPick: (index) => void, onTitle })
StoryPanelScreen({ quest, encounter, onFight })          // before a fight
ClosingPanelScreen({ quest, onTitle })                   // after the boss
ResultScreen gains `continueLabel?: string` (default 'Fight again')
```

App `Screen` gains Quest, Story, Closing. Survival takes `roster: EncounterTemplate[]` instead of one template.

## Art

Six monster prompts in `docs/art-style.md`, transparent-background spec, with the counting
lesson applied (arrangements spelled out). Files land at `public/art/monster/<slug>.png`, knocked
out if needed. The game tolerates a missing file until it lands.

## Testing

Content tests as listed. `quest.ts`: progress from an empty save is open then six locked; a won
Gob-nine record opens the Knight; records from another quest id do not count; a retreated record
does not count; complete only when the boss is won; a won Encounter stays open (replayable).
Screens: Quest screen focuses the first open row and disables locked rows; Story panel focuses
Fight and begins the right Encounter; the result screen's Continue leads to the Quest screen with
the newly opened row focused; boss win leads to the closing panel; Survival's second fight is the
Knight. Resume: a saved Knight fight resolves to the Knight template; an unknown monster id shows
the failure screen.

Invariants written from the design:
1. Playing the Quest in order through `play.ts` opens each Encounter exactly when the previous is
   won and completes the Quest on the boss.
2. Every template in `QUEST_1` resolves through `findTemplate`, and `findTemplate` never returns a
   template from a different quest id.
3. Survival's roster index never leaves `[0, 6]` for any number of wins.
