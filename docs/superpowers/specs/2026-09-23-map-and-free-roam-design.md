# The Map with Fogged regions, and Free Roam: design

Settled 2026-09-23 with Brendon. Rules from `docs/design.md` (Map, Fogged, Free Roam) and the
glossary in `CONTEXT.md`. ADR-0001 holds: nothing new is stored; every state below is derived
from the save.

## Scope

A Map screen that replaces the Quest list, with one region per Skill; Fog over regions whose
Quest cannot start; Free Roam fights in a completed region; the closing panel shown only when a
win completes its Quest. One new image.

Deferred: Quests for powers and long division (their regions exist only to be Fogged); Survival
on any roster but Quest 1; the "rows open" hint; a Loot preview on the Quest screen.

## Decisions Brendon made

| Question | Answer |
|---|---|
| Free Roam in this plan | Yes |
| How a Free Roam fight is recorded | Under the Quest's own id, like any fight in that Quest |
| Which monster Free Roam fights | A random one from the region, at normal HP |
| Map art | One generated 16:9 image with four regions, hotspots on top, Fog drawn in CSS |
| When Play opens the Map | Always, from the first session; the Map replaces the Quest list |
| Tapping a region | Opens the Quest screen; that screen gains Free Roam once the Quest is complete |

## Content (`src/content/map.ts`)

```ts
export interface Region {
  id: string;
  name: string;
  skill: SkillId;
  questId: string | null;          // null while no Quest exists for the Skill
  hotspot: { left: number; top: number; width: number; height: number }; // percent of the image
}
export const MAP_BACKGROUND = 'map-01';
export const REGIONS: Region[];  // in Skill order
```

| id | name | skill | questId | hotspot (left, top, width, height) |
|---|---|---|---|---|
| `fortress` | The Fortress of Twelves | times-table | `fortress-of-twelves` | 6, 40, 40, 50 |
| `foundry` | The Golem Foundry | multi-digit-multiplication | `golem-foundry` | 50, 55, 44, 40 |
| `peak` | The Storm Peak | powers | null | 52, 4, 42, 46 |
| `delta` | The Long Delta | long-division | null | 6, 4, 40, 32 |

Hotspots are content so the art can be regenerated without a code change. `map.ts` imports only
types from `quest1.ts`; the Quest for a region is looked up by id in `QUESTS` at the call site.

## Rules (`src/game/map.ts`, pure)

```ts
export const RegionState = { Fogged: 'fogged', Open: 'open', Complete: 'complete' } as const;
export type RegionState = (typeof RegionState)[keyof typeof RegionState];
export function regionState(save: SaveData, region: Region): RegionState;
export function fogLine(region: Region): string;
export function regionProgress(save: SaveData, region: Region): { won: number; total: number } | null;
export function freeRoamTemplate(quest: Quest, rng?: () => number): QuestEncounter;
export function completesQuest(before: SaveData, after: SaveData, quest: Quest): boolean;
```

- `regionState`: Complete when the region's Quest exists and `questComplete`; Open when it exists
  and `questOpen`; otherwise Fogged. A region with no Quest is always Fogged, whatever a Learning
  Plan unlocks.
- `fogLine`: "The Guide holds the key." for a Fogged region whose Quest exists; "Nothing lives
  here yet." for one with no Quest. Only a Fogged region shows a line.
- `regionProgress`: won Encounters out of the Quest's Encounters, or null with no Quest.
- `freeRoamTemplate`: one of the Quest's Encounters, picked with `rng`, clamped into range. It is
  the Quest's own template, unchanged: the Quest's id, the monster's HP and Loot pool.
- `completesQuest`: the Quest was not complete in `before` and is complete in `after`. The App
  shows the closing panel only when this is true for the Quest just fought. Today the panel shows
  on every boss win, replays included; this fixes that for replay from the Quest screen too.

## Screens

### Map (`src/ui/MapScreen.tsx`)

- Replaces `QuestListScreen`, which is deleted with its test. Play always opens the Map when no
  Encounter is open; a resumed Encounter still resumes first.
- The image `art('background/map-01')` fills a 16:9 panel of at most 1100 px wide. Over it, one
  button per region at its hotspot, named by the region's name, with its state under the name:
  "3 of 7" when Open, "Complete" when Complete, the fog line when Fogged.
- A Fogged region's button is disabled and carries the `fogged` class: a translucent cloud layer
  in CSS, no image. Nothing relies on colour alone; the line says what the Fog means.
- Focus starts on the first Open region, or the last Complete one when none is Open, with
  `useFocusOnMount`. Tab order is Skill order. Title sits in `ScreenNav`.
- Until the map image lands, the panel shows the page background and the hotspots still work.

### Quest screen

- Gains a Free Roam button in its `ScreenNav`, after Title, only when `questComplete`. A Map button
  before Title goes back to the Map (added 2026-09-25 after play testing).
- `onFreeRoam` is a new prop. The App starts `fight(save, freeRoamTemplate(quest, rng))`: no
  Story Panel, then the Encounter screen exactly as any Quest fight, then the result screen, and
  Continue returns to the Quest screen.

### App routing

- `Screen.Quests` and the Quest list go; `Screen.Map` replaces them. Play opens the Map.
- The result screen's Continue goes to the closing panel only when `completesQuest(saveBefore,
  save, fought)`; otherwise to the Quest screen for a Quest fight, or the Title after Survival.

## Art

One prompt, in `docs/art-style.md` under a new heading, for `art-src/background/map-01.png`: a
16:9 painted world map in the game's style with four regions in the positions above, the hill
with the Fortress lower left, the Foundry's smokestacks lower right, a stormy peak upper right, a
river delta upper left, no text. `scripts/shrink.py` builds the WebP. The art test in
`src/content/quest1.test.ts` requires `background/map-01` once its master exists, like Quest 2's
art.

## Glossary

`CONTEXT.md`: **Fogged** gains "A region with no Quest yet is always Fogged." **Free Roam**
gains "started from the Quest screen once the Quest is complete; recorded like any fight in that
Quest, so it can drop Loot." **Map** is unchanged.

## Invariants (each gets a test derived from this design)

1. Every region with a Quest names a Quest in `QUESTS`, and every Quest has exactly one region.
2. A region with no Quest is Fogged for every save, including one whose Learning Plan unlocks
   its Skill.
3. A new save shows exactly one Open region and three Fogged ones; a save that completed Quest 1
   shows one Complete, one Open, two Fogged.
4. `freeRoamTemplate` returns one of the Quest's own templates for every rng value in [0, 1).
5. A Free Roam win is recorded under the Quest's id, drops Loot by the normal rule, and leaves
   `questComplete` true.
6. The closing panel shows for the win that completes a Quest and never for a later boss win,
   whether from Free Roam or a replay.
7. Through the real screens: Play opens the Map; a Fogged region cannot be tapped; a lit region
   opens its Quest screen; Free Roam on a complete Quest goes straight to a fight and Continue
   returns to the Quest screen.
