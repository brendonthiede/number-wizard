# The Map with Fogged Regions and Free Roam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Quest list with a world Map of four regions, Fogged where a Quest cannot start, and add Free Roam fights in a completed region.

**Architecture:** Regions are content (`src/content/map.ts`); their state is derived in a pure module (`src/game/map.ts`) from the existing Quest rules. `MapScreen` draws hotspots over one image. Free Roam reuses the Quest's own Encounter template, so combat, Loot and the result flow are untouched. The closing panel moves to a first-completion rule.

**Tech Stack:** Vite 8, React 19, TypeScript 7 strict with `noUncheckedIndexedAccess`, Vitest 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-map-and-free-roam-design.md`. Read it before any task; its seven invariants are the acceptance tests.

## Global Constraints

- TDD is mandatory: write the failing test, run it and see it fail, then write the code.
- No magic strings in production code: state-like unions are `as const` objects with a derived type, compared as `RegionState.Fogged`. Tests may use literals.
- Use the `CONTEXT.md` vocabulary: Map, region, Fogged, Free Roam, Quest, Encounter, Skill, Loot, Guide.
- Comments state the constraint in one or two sentences; never narrate how you found something.
- Docstrings: every top-level function in a file the branch changes gets a `/** */` docstring. Run `npm run docstrings` before every commit and fix everything it lists.
- Never add a `Co-Authored-By`, "Generated with", or any Claude or Anthropic attribution to a commit. Never push.
- Component tests start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`.
- Nothing new is stored in the save (ADR-0001). Every region state is derived.
- Exact values from the spec: fog lines "The Guide holds the key." and "Nothing lives here yet."; region ids `fortress`, `foundry`, `peak`, `delta`; hotspots as in the spec's table; map image slug `map-01`; button labels "Free Roam" and "Title".
- Before each commit: `npm test` and `npm run typecheck` pass.

## Review Focus

Inputs the spec implies but no rule states outright; each has its test in the task named.
1. A save whose Learning Plan unlocks `powers` still shows the peak Fogged, because no Quest exists (Task 2).
2. `freeRoamTemplate` with rng exactly 0 and exactly 0.999999 returns the first and the last Encounter, never an index past the end (Task 2).
3. A resumed Encounter (open on load) that completes a Quest still shows the closing panel, because `saveBefore` is set at resume (Task 5).
4. A Retreat from a Free Roam fight returns to the Quest screen and never to the closing panel (Task 5).
5. The Map before its image exists: the panel has no background image and every hotspot still renders and works (Task 3).

## File map

| File | Responsibility |
|---|---|
| `src/content/map.ts` (new) | `Region`, `REGIONS`, `MAP_BACKGROUND` |
| `src/game/map.ts` (new) | `RegionState`, `regionState`, `fogLine`, `regionProgress`, `freeRoamTemplate`, `completesQuest` |
| `src/ui/MapScreen.tsx` (new) | the Map screen |
| `src/ui/QuestScreen.tsx` | Free Roam button |
| `src/App.tsx` | Map routing, Free Roam, first-completion closing rule; Quest list removed |
| `src/ui/QuestListScreen.tsx`, `.test.tsx` | deleted |
| `src/ui/styles.css` | `.map-panel`, `.region` |
| `docs/art-style.md`, `CONTEXT.md`, `src/content/quest1.test.ts` | prompt, glossary, art check |

---

### Task 1: Regions as content

**Files:**
- Create: `src/content/map.ts`, `src/content/map.test.ts`
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: `Skill`, `SkillId` from `src/engine/types.ts`; `QUESTS` from `src/content/quest1.ts` (test only).
- Produces: `Region { id: string; name: string; skill: SkillId; questId: string | null; hotspot: { left: number; top: number; width: number; height: number } }`; `REGIONS: Region[]`; `MAP_BACKGROUND = 'map-01'`.

- [ ] **Step 1: Write the failing test**

Create `src/content/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAP_BACKGROUND, REGIONS } from './map';
import { QUESTS } from './quest1';

describe('Map regions', () => {
  it('has four regions in Skill order, two with a Quest and two without', () => {
    expect(REGIONS.map((r) => [r.id, r.skill, r.questId])).toEqual([
      ['fortress', 'times-table', 'fortress-of-twelves'],
      ['foundry', 'multi-digit-multiplication', 'golem-foundry'],
      ['peak', 'powers', null],
      ['delta', 'long-division', null],
    ]);
    expect(REGIONS.map((r) => r.name)).toEqual(['The Fortress of Twelves', 'The Golem Foundry', 'The Storm Peak', 'The Long Delta']);
    expect(MAP_BACKGROUND).toBe('map-01');
  });

  it('every region with a Quest names one in QUESTS, and every Quest has exactly one region (invariant 1)', () => {
    const questIds = QUESTS.map((q) => q.id);
    for (const r of REGIONS) if (r.questId !== null) expect(questIds).toContain(r.questId);
    for (const id of questIds) expect(REGIONS.filter((r) => r.questId === id)).toHaveLength(1);
  });

  it('keeps every hotspot inside the image and clear of the others', () => {
    for (const r of REGIONS) {
      const { left, top, width, height } = r.hotspot;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100);
      expect(top + height).toBeLessThanOrEqual(100);
    }
    const overlaps = (a: typeof REGIONS[number], b: typeof REGIONS[number]) =>
      a.hotspot.left < b.hotspot.left + b.hotspot.width && b.hotspot.left < a.hotspot.left + a.hotspot.width
      && a.hotspot.top < b.hotspot.top + b.hotspot.height && b.hotspot.top < a.hotspot.top + a.hotspot.height;
    for (const a of REGIONS) for (const b of REGIONS) if (a !== b) expect(overlaps(a, b), `${a.id} and ${b.id}`).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/map.test.ts`
Expected: FAIL, cannot resolve `./map`.

- [ ] **Step 3: Write the content**

Create `src/content/map.ts`:

```ts
import { Skill, type SkillId } from '../engine/types';

/** One region of the Map. A region with no Quest yet is always Fogged. */
export interface Region {
  id: string;
  name: string;
  skill: SkillId;
  questId: string | null;
  // Percent of the map image, so the art can be regenerated without a code change.
  hotspot: { left: number; top: number; width: number; height: number };
}

/** The map image's slug under `background/`. */
export const MAP_BACKGROUND = 'map-01';

/** The four regions in Skill order. Quest ids are literals: this module must not import a Quest at runtime. */
export const REGIONS: Region[] = [
  { id: 'fortress', name: 'The Fortress of Twelves', skill: Skill.TimesTable, questId: 'fortress-of-twelves', hotspot: { left: 6, top: 40, width: 40, height: 50 } },
  { id: 'foundry', name: 'The Golem Foundry', skill: Skill.MultiDigit, questId: 'golem-foundry', hotspot: { left: 50, top: 55, width: 44, height: 40 } },
  { id: 'peak', name: 'The Storm Peak', skill: Skill.Powers, questId: null, hotspot: { left: 52, top: 4, width: 42, height: 46 } },
  { id: 'delta', name: 'The Long Delta', skill: Skill.LongDivision, questId: null, hotspot: { left: 6, top: 4, width: 40, height: 32 } },
];
```

- [ ] **Step 4: Glossary**

In `CONTEXT.md`, append to the **Fogged** definition line (before its `_Avoid_` line): ` A region with no Quest yet is always Fogged.` Append to the **Free Roam** definition line: ` Started from the Quest screen once the Quest is complete; recorded like any fight in that Quest, so it can drop Loot.`

- [ ] **Step 5: Run everything**

Run: `npx vitest run src/content && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/content/map.ts src/content/map.test.ts CONTEXT.md
git commit -m "feat: the Map's four regions as content"
```

---

### Task 2: Region rules, Free Roam template, first-completion rule

**Files:**
- Create: `src/game/map.ts`, `src/game/map.test.ts`

**Interfaces:**
- Consumes: `REGIONS`, `Region` (Task 1); `QUESTS`, `Quest`, `QuestEncounter` from `src/content/quest1.ts`; `questComplete`, `questOpen` from `src/game/quest.ts`; `SaveData`.
- Produces:
  - `RegionState = { Fogged: 'fogged', Open: 'open', Complete: 'complete' } as const` and its type.
  - `questFor(region: Region): Quest | undefined`.
  - `regionState(save: SaveData, region: Region): RegionState`.
  - `fogLine(region: Region): string`.
  - `regionProgress(save: SaveData, region: Region): { won: number; total: number } | null`.
  - `freeRoamTemplate(quest: Quest, rng?: () => number): QuestEncounter`.
  - `completesQuest(before: SaveData, after: SaveData, quest: Quest): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/game/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../content/map';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { EncounterStatus } from '../engine/combat';
import { parseLearningPlan, PLAN_KIND } from './learningPlan';
import { completesQuest, fogLine, freeRoamTemplate, questFor, regionProgress, regionState } from './map';
import { emptySave, withCharacter, withLearningPlan, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-23T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const won = (questId: string, monsterId: string): EncounterRecord => ({
  id: `${questId}-${monsterId}`, questId, monsterId, monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(),
  status: EncounterStatus.Won, xp: 12, loot: null,
});
const withWins = (save: SaveData, questId: string, monsters: string[]): SaveData =>
  ({ ...save, encounters: [...save.encounters, ...monsters.map((m) => won(questId, m))] });
const quest1Done = (): SaveData => withWins(base(), QUEST_1.id, QUEST_1.encounters.map((e) => e.monsterId));
const [fortress, foundry, peak, delta] = REGIONS as [typeof REGIONS[0], typeof REGIONS[0], typeof REGIONS[0], typeof REGIONS[0]];

describe('regionState', () => {
  it('a new save: one Open region, three Fogged (invariant 3)', () => {
    expect(REGIONS.map((r) => regionState(base(), r))).toEqual(['open', 'fogged', 'fogged', 'fogged']);
  });

  it('Quest 1 complete: one Complete, one Open, two Fogged (invariant 3)', () => {
    expect(REGIONS.map((r) => regionState(quest1Done(), r))).toEqual(['complete', 'open', 'fogged', 'fogged']);
  });

  it('a Learning Plan that unlocks a Skill lifts Fog only where a Quest exists (invariant 2)', () => {
    const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, unlockedSkills: ['multi-digit-multiplication', 'powers', 'long-division'] });
    const save = withLearningPlan(base(), plan, NOW);
    expect(regionState(save, foundry)).toBe('open');
    expect(regionState(save, peak)).toBe('fogged');
    expect(regionState(save, delta)).toBe('fogged');
  });

  it('questFor resolves a region to its Quest, or undefined with none', () => {
    expect(questFor(fortress)).toBe(QUEST_1);
    expect(questFor(foundry)).toBe(QUEST_2);
    expect(questFor(peak)).toBeUndefined();
  });
});

describe('fogLine and regionProgress', () => {
  it('names the Guide for a locked Quest and says nothing lives in a region with none', () => {
    expect(fogLine(foundry)).toBe('The Guide holds the key.');
    expect(fogLine(peak)).toBe('Nothing lives here yet.');
  });

  it('counts won Encounters out of the Quest, or null with no Quest', () => {
    expect(regionProgress(base(), fortress)).toEqual({ won: 0, total: 7 });
    expect(regionProgress(withWins(base(), QUEST_1.id, ['gob-nine', 'fourmidable-knight', 'gob-nine']), fortress)).toEqual({ won: 2, total: 7 });
    expect(regionProgress(quest1Done(), fortress)).toEqual({ won: 7, total: 7 });
    expect(regionProgress(base(), peak)).toBeNull();
  });
});

describe('freeRoamTemplate (invariant 4)', () => {
  it('returns one of the Quest\'s own templates for every rng value, first at 0 and last just under 1', () => {
    expect(freeRoamTemplate(QUEST_1, () => 0)).toBe(QUEST_1.encounters[0]);
    expect(freeRoamTemplate(QUEST_1, () => 0.999999)).toBe(QUEST_1.encounters[6]);
    let seed = 5;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const t = freeRoamTemplate(QUEST_2, rng);
      expect(QUEST_2.encounters).toContain(t);
      seen.add(t.monsterId);
    }
    expect(seen.size).toBe(7);
  });

  it('is the template itself: the Quest id, the monster HP and its Loot pool, unchanged', () => {
    const t = freeRoamTemplate(QUEST_1, () => 0.5);
    expect(t).toBe(QUEST_1.encounters[3]);
    expect(t.questId).toBe(QUEST_1.id);
    expect(t.lootPool).toEqual(['bat-wing-cloak']);
  });
});

describe('completesQuest (invariant 6)', () => {
  const sixDone = () => withWins(base(), QUEST_1.id, QUEST_1.encounters.slice(0, 6).map((e) => e.monsterId));

  it('is true only for the win that completes the Quest', () => {
    const before = sixDone();
    const after = withWins(before, QUEST_1.id, ['twelve-headed-hydra']);
    expect(completesQuest(before, after, QUEST_1)).toBe(true);
    expect(completesQuest(after, withWins(after, QUEST_1.id, ['twelve-headed-hydra']), QUEST_1)).toBe(false);
    expect(completesQuest(before, withWins(before, QUEST_1.id, ['gob-nine']), QUEST_1)).toBe(false);
    expect(completesQuest(before, after, QUEST_2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/map.test.ts`
Expected: FAIL, cannot resolve `./map`.

- [ ] **Step 3: Write the module**

Create `src/game/map.ts`:

```ts
import type { Region } from '../content/map';
import { QUESTS, type Quest, type QuestEncounter } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import type { SaveData } from '../storage/save';
import { questComplete, questOpen } from './quest';

/** What a region shows on the Map: Fogged until its Quest can start, Open while it is played, Complete when won. */
export const RegionState = { Fogged: 'fogged', Open: 'open', Complete: 'complete' } as const;
export type RegionState = (typeof RegionState)[keyof typeof RegionState];

/** The Quest behind a region, or undefined while the Skill has none. */
export const questFor = (region: Region): Quest | undefined => QUESTS.find((q) => q.id === region.questId);

/** A region with no Quest is Fogged whatever a Learning Plan unlocks: there is nothing to start. */
export function regionState(save: SaveData, region: Region): RegionState {
  const quest = questFor(region);
  if (!quest) return RegionState.Fogged;
  if (questComplete(save, quest)) return RegionState.Complete;
  return questOpen(save, quest) ? RegionState.Open : RegionState.Fogged;
}

/** The line under a Fogged region: only the Learning Plan lifts Fog from a Quest, and nothing lifts it where no Quest exists. */
export const fogLine = (region: Region): string =>
  region.questId === null ? 'Nothing lives here yet.' : 'The Guide holds the key.';

/** Won Encounters out of the Quest's Encounters; a monster won twice counts once. Null with no Quest. */
export function regionProgress(save: SaveData, region: Region): { won: number; total: number } | null {
  const quest = questFor(region);
  if (!quest) return null;
  const won = new Set(save.encounters.filter((r) => r.questId === quest.id && r.status === EncounterStatus.Won).map((r) => r.monsterId));
  return { won: quest.encounters.filter((e) => won.has(e.monsterId)).length, total: quest.encounters.length };
}

/** A Free Roam fight: one of the Quest's own Encounters, so it records, drops Loot and routes like any fight in that Quest. */
export function freeRoamTemplate(quest: Quest, rng: () => number = Math.random): QuestEncounter {
  const i = Math.min(quest.encounters.length - 1, Math.max(0, Math.floor(rng() * quest.encounters.length)));
  return quest.encounters[i]!;
}

/** Whether the fight between `before` and `after` completed the Quest. The closing panel shows only then, never on a replay. */
export const completesQuest = (before: SaveData, after: SaveData, quest: Quest): boolean =>
  !questComplete(before, quest) && questComplete(after, quest);
```

- [ ] **Step 4: Run everything**

Run: `npx vitest run src/game/map.test.ts && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/map.ts src/game/map.test.ts
git commit -m "feat: region state, the Free Roam template and the first-completion rule"
```

---

### Task 3: The Map screen, its art prompt and the art check

**Files:**
- Create: `src/ui/MapScreen.tsx`, `src/ui/MapScreen.test.tsx`
- Modify: `src/ui/styles.css`, `docs/art-style.md`, `src/content/quest1.test.ts`

**Interfaces:**
- Consumes: `REGIONS`, `MAP_BACKGROUND` (Task 1); `RegionState`, `regionState`, `fogLine`, `regionProgress`, `questFor` (Task 2); `art` from `src/ui/art.ts`; `ScreenNav`; `useFocusOnMount`.
- Produces: `MapScreen({ save, onPick, onTitle })` with `onPick: (quest: Quest) => void`. Hotspot buttons are named by the region's name (match with a regex: the state line is inside the button). A Fogged button is disabled and has the class `region fogged`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/MapScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';
import { MapScreen } from './MapScreen';

afterEach(cleanup);

const NOW = '2026-09-23T12:00:00.000Z';
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const won = (monsterId: string): EncounterRecord => ({
  id: monsterId, questId: QUEST_1.id, monsterId, monsterMaxHp: 6, startedAt: NOW, endedAt: NOW, status: EncounterStatus.Won, xp: 12, loot: null,
});
const quest1Done = (): SaveData => ({ ...base(), encounters: QUEST_1.encounters.map((e) => won(e.monsterId)) });
const region = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('MapScreen', () => {
  it('shows four regions over the map image, one Open and three Fogged on a new save, with the Open one focused', () => {
    render(<MapScreen save={base()} onPick={() => {}} onTitle={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Map' })).toBeTruthy();
    expect(screen.getAllByRole('button').filter((b) => b.classList.contains('region'))).toHaveLength(4);
    expect(document.activeElement).toBe(region(/The Fortress of Twelves/));
    expect(region(/The Fortress of Twelves/).textContent).toContain('0 of 7');
    expect(region(/The Fortress of Twelves/).disabled).toBe(false);
    for (const name of [/The Golem Foundry/, /The Storm Peak/, /The Long Delta/]) {
      expect(region(name).disabled).toBe(true);
      expect(region(name).className).toBe('region fogged');
    }
    expect(region(/The Golem Foundry/).textContent).toContain('The Guide holds the key.');
    expect(region(/The Storm Peak/).textContent).toContain('Nothing lives here yet.');
    expect((screen.getByTestId('map-panel') as HTMLElement).style.backgroundImage).toContain('art/background/map-01.webp');
  });

  it('a complete region says so, and focus goes to the first Open region', () => {
    render(<MapScreen save={quest1Done()} onPick={() => {}} onTitle={() => {}} />);
    expect(region(/The Fortress of Twelves/).textContent).toContain('Complete');
    expect(region(/The Fortress of Twelves/).className).toBe('region complete');
    expect(region(/The Golem Foundry/).disabled).toBe(false);
    expect(document.activeElement).toBe(region(/The Golem Foundry/));
  });

  it('focuses the last Complete region when none is Open', () => {
    const all = { ...quest1Done(), encounters: [...quest1Done().encounters, ...QUEST_2.encounters.map((e) => ({ ...won(e.monsterId), questId: QUEST_2.id, id: `q2-${e.monsterId}` }))] };
    render(<MapScreen save={all} onPick={() => {}} onTitle={() => {}} />);
    expect(document.activeElement).toBe(region(/The Golem Foundry/));
  });

  it('picks a lit region\'s Quest, ignores a Fogged one, and keeps Title in the screen navigation', () => {
    const onPick = vi.fn();
    const onTitle = vi.fn();
    render(<MapScreen save={base()} onPick={onPick} onTitle={onTitle} />);
    fireEvent.click(region(/The Golem Foundry/));
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(region(/The Fortress of Twelves/));
    expect(onPick).toHaveBeenCalledWith(QUEST_1);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalledTimes(1);
    expect(nav.contains(screen.getByRole('button', { name: 'Title' }))).toBe(true);
    expect(nav.contains(region(/The Fortress of Twelves/))).toBe(false);
  });

  it('places each hotspot by its percentages, so the art can be regenerated without a code change', () => {
    render(<MapScreen save={base()} onPick={() => {}} onTitle={() => {}} />);
    const style = region(/The Fortress of Twelves/).style;
    expect([style.left, style.top, style.width, style.height]).toEqual(['6%', '40%', '40%', '50%']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/MapScreen.test.tsx`
Expected: FAIL, cannot resolve `./MapScreen`.

- [ ] **Step 3: Write the screen**

Create `src/ui/MapScreen.tsx`:

```tsx
import { MAP_BACKGROUND, REGIONS, type Region } from '../content/map';
import type { Quest } from '../content/quest1';
import { fogLine, questFor, regionProgress, regionState, RegionState } from '../game/map';
import type { SaveData } from '../storage/save';
import { art } from './art';
import { ScreenNav } from './ScreenNav';
import { useFocusOnMount } from './useFocusOnMount';

interface MapScreenProps {
  save: SaveData;
  onPick: (quest: Quest) => void;
  onTitle: () => void;
}

/** The line under a region's name: its progress while Open, "Complete", or why it is Fogged. */
function stateLine(save: SaveData, region: Region, state: RegionState): string {
  if (state === RegionState.Fogged) return fogLine(region);
  if (state === RegionState.Complete) return 'Complete';
  const p = regionProgress(save, region)!;
  return `${p.won} of ${p.total}`;
}

/**
 * The world Map: one hotspot per region over the map image. A Fogged region is disabled and says
 * why. Focus starts on the first Open region, or the last Complete one when none is Open.
 */
export function MapScreen({ save, onPick, onTitle }: MapScreenProps) {
  const states = REGIONS.map((r) => regionState(save, r));
  const firstOpen = states.indexOf(RegionState.Open);
  const focusIndex = firstOpen !== -1 ? firstOpen : states.lastIndexOf(RegionState.Complete);
  const focused = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen map">
      <div className="screen-body">
        <h1>Map</h1>
        <div className="map-panel" data-testid="map-panel" style={{ backgroundImage: `url(${art(`background/${MAP_BACKGROUND}`)})` }}>
          {REGIONS.map((r, i) => {
            const state = states[i]!;
            const quest = questFor(r);
            return (
              <button
                key={r.id}
                type="button"
                className={`region ${state}`}
                style={{ left: `${r.hotspot.left}%`, top: `${r.hotspot.top}%`, width: `${r.hotspot.width}%`, height: `${r.hotspot.height}%` }}
                disabled={state === RegionState.Fogged}
                ref={i === focusIndex ? focused : undefined}
                onClick={() => { if (quest) onPick(quest); }}
              >
                <span className="region-name">{r.name}</span>
                <span className="region-state">{stateLine(save, r, state)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ScreenNav>
        <button type="button" onClick={onTitle}>Title</button>
      </ScreenNav>
    </main>
  );
}
```

`className` is `region open`, `region complete` or `region fogged`: the state value is the class, so the test's exact match holds.

- [ ] **Step 4: Styles**

Append to `src/ui/styles.css`:

```css
/* The Map. Hotspots are placed by content percentages so the image can be regenerated without a code change. */
.map-panel { position: relative; width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; border: 6px solid var(--frame); border-radius: 12px; background-size: cover; background-position: center; overflow: hidden; }
.region { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px; min-height: 0; border-radius: 12px; background: rgba(255, 255, 255, 0.78); text-align: center; }
.region-name { font-weight: 700; }
.region-state { font-size: 0.9rem; }
.region.complete { border-color: var(--hit); }
/* Fog: a translucent haze with a dashed edge. The line inside says what it means, so nothing rests on colour. */
.region.fogged { border-style: dashed; border-color: #8f8a94; color: #4a4650; background: repeating-linear-gradient(135deg, rgba(236, 233, 240, 0.9) 0 12px, rgba(220, 216, 226, 0.9) 12px 24px); }
.region.fogged:disabled { opacity: 1; cursor: default; }
@media (max-width: 700px) { .region { padding: 4px; font-size: 0.85rem; } .region-state { font-size: 0.75rem; } }
```

- [ ] **Step 5: The art prompt and the art check**

Append to `docs/art-style.md`:

```markdown
## Map prompt

One image. Save the master as `art-src/background/map-01.png`, then run `python3 scripts/shrink.py`. The regions must sit where the hotspots in `src/content/map.ts` expect them: Fortress lower left, Foundry lower right, a stormy peak upper right, a river delta upper left. The game shows the hotspots on the page background until the image exists.

### map-01: the world Map (background)

Flat cartoon illustration in a graphic-novel style: bold black outlines, bright saturated palette, simple shapes, minimal shading, no text, no letters, no numbers anywhere in the image. Friendly and slightly silly tone suitable for a 10-year-old. Clean composition with a single clear subject. A painted fantasy world map seen from high above, like a storybook endpaper, with parchment-coloured land, a winding road joining four places, and small stylised trees and hills between them. Lower left: a ruined stone fortress with twelve towers on a rocky hill above a swamp, lit by sickly green windows. Lower right: an underground foundry shown as a great iron door in a hillside with three brass smokestacks and an orange furnace glow. Upper right: a tall jagged mountain peak wrapped in dark storm clouds with forks of purple lightning. Upper left: a wide river splitting into many branches through green marshland and reed beds before reaching a pale sea. Leave the exact centre of the map calm with only road and grass. Aspect ratio is 16:9. This is a full scene with no characters; leave the center calm.
```

In `src/content/quest1.test.ts`, in the art test, add the map image as required once its master exists. Add the import `import { MAP_BACKGROUND } from './map';` and change the line

```ts
    expect(shipped.sort()).toEqual([...required, ...arrived].map((f) => `/public/art/${f}.webp`).sort());
```

to

```ts
    // The Map image arrives after the code too: required once its master is committed.
    const mapSlug = `background/${MAP_BACKGROUND}`;
    const mapArrived = masters.includes(`/art-src/${mapSlug}.png`) ? [mapSlug] : [];
    expect(shipped.sort()).toEqual([...required, ...arrived, ...mapArrived].map((f) => `/public/art/${f}.webp`).sort());
```

- [ ] **Step 6: Run everything**

Run: `npx vitest run src/ui/MapScreen.test.tsx src/content && npm run typecheck && npm run docstrings`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/MapScreen.tsx src/ui/MapScreen.test.tsx src/ui/styles.css docs/art-style.md src/content/quest1.test.ts
git commit -m "feat: the Map screen with Fogged regions, its art prompt and art check"
```

---

### Task 4: Free Roam on the Quest screen

**Files:**
- Modify: `src/ui/QuestScreen.tsx`, `src/ui/QuestScreen.test.tsx`

**Interfaces:**
- Consumes: `questComplete` from `src/game/quest.ts`.
- Produces: `QuestScreen` gains a required prop `onFreeRoam: () => void`. The "Free Roam" button renders in `ScreenNav`, after Title, only when the Quest is complete.

- [ ] **Step 1: Write the failing test**

Add to `src/ui/QuestScreen.test.tsx`, inside the `describe('QuestScreen', ...)` block. The file's existing `render(<QuestScreen ... />)` calls lack `onFreeRoam`; add `onFreeRoam={() => {}}` to each of them so they type-check.

```tsx
  it('offers Free Roam in the screen navigation only once the Quest is complete', () => {
    const onFreeRoam = vi.fn();
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={onFreeRoam} />);
    expect(screen.queryByRole('button', { name: 'Free Roam' })).toBeNull();
    cleanup();
    const done = { ...base(), encounters: QUEST_1.encounters.map((e) => won(e.monsterId)) };
    render(<QuestScreen save={done} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={onFreeRoam} />);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    const free = screen.getByRole('button', { name: 'Free Roam' });
    expect(nav.contains(free)).toBe(true);
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Title', 'Free Roam']);
    fireEvent.click(free);
    expect(onFreeRoam).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/QuestScreen.test.tsx`
Expected: FAIL, no button named "Free Roam".

- [ ] **Step 3: Implement**

In `src/ui/QuestScreen.tsx`:
- import `questComplete` alongside the other imports from `'../game/quest'`;
- add `onFreeRoam: () => void;` to `QuestScreenProps` with the comment `// a random fight in the region; offered once the Quest is complete`;
- destructure `onFreeRoam` in the component;
- change the nav to:

```tsx
      <ScreenNav>
        <button type="button" onClick={onTitle}>Title</button>
        {questComplete(save, quest) && <button type="button" onClick={onFreeRoam}>Free Roam</button>}
      </ScreenNav>
```

Update the component docstring to end with: `Once the Quest is complete, Free Roam starts a random fight in the region.`

- [ ] **Step 4: Run everything**

Run: `npx vitest run src/ui/QuestScreen.test.tsx && npm run typecheck`
Expected: the typecheck fails only in `src/App.tsx`, which does not pass `onFreeRoam` yet. Add `onFreeRoam={() => {}}` to the `QuestScreen` element in `src/App.tsx` for now; Task 5 replaces it. Then: `npm test && npm run typecheck && npm run docstrings` all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/QuestScreen.tsx src/ui/QuestScreen.test.tsx src/App.tsx
git commit -m "feat: the Quest screen offers Free Roam once the Quest is complete"
```

---

### Task 5: Route through the Map, Free Roam fights, and the first-completion closing rule

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`
- Delete: `src/ui/QuestListScreen.tsx`, `src/ui/QuestListScreen.test.tsx`

**Interfaces:**
- Consumes: `MapScreen` (Task 3); `QuestScreen.onFreeRoam` (Task 4); `freeRoamTemplate`, `completesQuest` (Task 2).
- Produces: `App` keeps its props. `Screen.Map` replaces `Screen.Quests`.

Routing rules from the spec, all tested below:
- Play with an open Encounter resumes it. Otherwise Play always opens the Map.
- Tapping a lit region opens its Quest screen. Free Roam starts `fight(save, freeRoamTemplate(quest, rng))` with no Story Panel.
- Continue after a Quest fight goes to the closing panel only when the win completed the Quest; otherwise to the Quest screen. After Survival it goes to the Title.

- [ ] **Step 1: Update the existing App tests**

In `src/App.test.tsx`, every test that clicks Play and then expects the heading "The Fortress of Twelves" now goes through the Map. After each `fireEvent.click(await screen.findByRole('button', { name: 'Play' }))` in those tests (lines near 27, 54, 82, 145), insert:

```tsx
    fireEvent.click(await screen.findByRole('button', { name: /The Fortress of Twelves/ }));
```

In the Quest 2 integration test, change the two exact-name lookups `{ name: 'The Golem Foundry' }` on the Map (the focus assertion and the click, near lines 441 and 442) to the regex `{ name: /The Golem Foundry/ }`; the heading assertion after them stays.

Replace the test `'Play still goes straight to Quest 1 while it is the only open Quest'` with:

```tsx
    it('Play opens the Map; the Fortress is the only lit region on a new save, and it opens Quest 1', async () => {
      const store = memoryStore();
      await store.save(named());
      render(<App store={store} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
      expect(await screen.findByRole('heading', { name: 'Map' })).toBeTruthy();
      expect((screen.getByRole('button', { name: /The Golem Foundry/ }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: /The Fortress of Twelves/ }));
      expect(await screen.findByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
    });
```

- [ ] **Step 2: Write the failing integration tests**

Add to `src/App.test.tsx`, inside `describe('App', ...)`, after the `'the first won fight reveals'` test:

```tsx
  describe('Map and Free Roam (invariants 5, 6, 7)', () => {
    const T = '2026-09-23T12:00:00.000Z';
    const quest1Done = (): SaveData => ({
      ...named(),
      encounters: QUEST_1.encounters.map((e) => ({
        id: `q1-${e.monsterId}`, questId: QUEST_1.id, monsterId: e.monsterId, monsterMaxHp: e.monsterMaxHp,
        startedAt: T, endedAt: T, status: 'won' as const, xp: 1, loot: null,
      })),
    });
    const winFight = () => {
      for (let i = 0; i < 20 && screen.queryByRole('heading', { name: 'Victory!' }) === null; i++) {
        const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
        for (const d of String(a! * b!)) fireEvent.click(screen.getByRole('button', { name: d }));
        fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
        act(() => { vi.advanceTimersByTime(1500); });
      }
      expect(screen.getByRole('heading', { name: 'Victory!' })).toBeTruthy();
    };

    it('Free Roam from a complete region fights a random monster with no Story Panel, drops its Loot, and returns to the Quest screen', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const store = memoryStore();
        await store.save(quest1Done());
        // rng 0.5 picks the fourth Encounter, the Ate-Bat, and answers are always right.
        render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
        const fortress = await screen.findByRole('button', { name: /The Fortress of Twelves/ });
        expect(fortress.textContent).toContain('Complete');
        fireEvent.click(fortress);
        fireEvent.click(await screen.findByRole('button', { name: 'Free Roam' }));
        expect(await screen.findByLabelText('Answer')).toBeTruthy();
        expect(screen.getByText('The Ate-Bat')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Fight' })).toBeNull();
        winFight();
        const saved = (await store.load())!;
        expect(saved.encounters.at(-1)).toMatchObject({ questId: QUEST_1.id, monsterId: 'ate-bat', status: 'won', loot: 'bat-wing-cloak' });
        expect(screen.getByText('You found the Bat-Wing Cloak!')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Free Roam' })).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('a Retreat from a Free Roam fight returns to the Quest screen, never the closing panel', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const store = memoryStore();
        await store.save(quest1Done());
        render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
        fireEvent.click(await screen.findByRole('button', { name: /The Fortress of Twelves/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'Free Roam' }));
        await screen.findByLabelText('Answer');
        for (let i = 0; i < 5; i++) {
          const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
          for (const d of String(a! * b! + 1)) fireEvent.click(screen.getByRole('button', { name: d }));
          fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
          act(() => { vi.advanceTimersByTime(3000); });
        }
        expect(screen.getByText('You retreat to fight another day.')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('replaying the boss of a complete Quest never shows the closing panel again (invariant 6)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const store = memoryStore();
        await store.save(quest1Done());
        render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
        fireEvent.click(await screen.findByRole('button', { name: /The Fortress of Twelves/ }));
        fireEvent.click(await screen.findByRole('button', { name: /Twelve-Headed Hydra/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
        await screen.findByLabelText('Answer');
        winFight();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.queryByText(QUEST_1.closing.text)).toBeNull();
        expect(screen.getByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('a resumed Encounter that completes the Quest still shows the closing panel', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const sixDone = { ...quest1Done(), encounters: quest1Done().encounters.slice(0, 6) };
        const begun = beginEncounter(sixDone, QUEST_1.encounters[6]!, new Date(T), 'open-boss');
        const store = memoryStore();
        await store.save(begun.save);
        render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
        await screen.findByLabelText('Answer');
        winFight();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByText(QUEST_1.closing.text)).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });
  });
```

Imports this block needs in `src/App.test.tsx` (add any missing): `beginEncounter` from `./game/play`; `QUEST_1` from `./content/quest1`; `type SaveData` from `./storage/save`.

Note on the Hydra replay: its HP is 15 and a Critical Hit deals 2, so `winFight`'s cap of 20 casts covers it.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL. No heading "Map"; no button "Free Roam" on the App's Quest screen.

- [ ] **Step 4: Route through the Map**

In `src/App.tsx`:

- imports: remove `QuestListScreen` and `openQuests`; add `import { MapScreen } from './ui/MapScreen';` and `import { completesQuest, freeRoamTemplate } from './game/map';`.
- in `Screen`, replace `Quests: 'quests'` with `Map: 'map'`.
- replace `play`:

```tsx
  // Play resumes the open Encounter without re-beginning it, so a reload never loses a fight; otherwise it opens the Map.
  const play = (data: SaveData) => {
    if (data.activeEncounter) {
      setXpBefore(data.character.xp);
      setSaveBefore(data);
      setEncounter(data.activeEncounter);
      setQuest(questOf(data.activeEncounter) ?? QUEST_1);
      setScreen(Screen.Encounter);
      return;
    }
    setScreen(Screen.Map);
  };
```

- replace the `Screen.Quests` case and the `Screen.Quest` case with:

```tsx
    case Screen.Map:
      return <MapScreen save={save} onPick={(q) => { setQuest(q); setScreen(Screen.Quest); }} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Quest:
      return (
        <QuestScreen
          save={save}
          quest={quest}
          onPick={(i) => { setPick(quest.encounters[i]!); setScreen(Screen.Story); }}
          onFreeRoam={() => fight(save, freeRoamTemplate(quest, rng))}
          onTitle={() => setScreen(Screen.Title)}
        />
      );
```

- in the `Screen.Result` case, replace the `boss` and `bossWon` lines and the `onAgain` with:

```tsx
      // The closing panel belongs to the win that completes a Quest: never a replay, a Retreat, or a Survival fight.
      const fought = questOf(encounter!);
      const completed = fought !== undefined && saveBefore !== null && completesQuest(saveBefore, save, fought);
      ...
          onAgain={() => setScreen(completed ? Screen.Closing : fought ? Screen.Quest : Screen.Title)}
```

Delete `src/ui/QuestListScreen.tsx` and `src/ui/QuestListScreen.test.tsx` with `git rm`.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run docstrings && npm run build`
Expected: all pass. If an older App test still expects the Quest list (a button named exactly "The Golem Foundry" on a list), it now finds the Map's region button by regex; do not weaken what the test asserts after that.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Play opens the Map, Free Roam fights, and the closing panel only on first completion"
```

---

## Self-review notes

- Spec coverage: content and glossary (Task 1); rules and invariants 2, 3, 4, 6 (Task 2); the screen, Fog, focus, art prompt and art check, Review Focus 5 (Task 3); Free Roam button (Task 4); routing, Free Roam fight, first-completion rule, invariants 5, 6, 7 and Review Focus 3 and 4 (Task 5).
- The Quest list is deleted in Task 5, the same task that removes its route, so the build is never broken between tasks.
- Task 4 leaves a placeholder `onFreeRoam={() => {}}` in `App.tsx` for one commit so the typecheck passes; Task 5 replaces it.
