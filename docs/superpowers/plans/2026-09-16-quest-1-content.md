# Quest 1 Content and Quest Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quest 1, "The Fortress of Twelves", as content: seven Encounters with story panels and a Loot pool, a Quest screen to move through them, template resolution on resume, and Survival walking the roster.

**Architecture:** Content lives in `src/content/quest1.ts` as plain data. Progress is derived from the Encounter records already in the save (`src/game/quest.ts`, pure), so the save shape does not change. Three thin screens (Quest list, story panel, closing panel) and small prop additions to existing screens; `App` resolves every template through `findTemplate`.

**Tech Stack:** React 19, TypeScript 7, Vitest 5 with jsdom and Testing Library for components that branch. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-16-quest-1-content-design.md`. Rules: `docs/design.md`. Vocabulary: `CONTEXT.md`.

## Global Constraints

- TDD is mandatory: failing test first, run it, then code, then run it. Paste RED and GREEN output in reports.
- CONTEXT.md terms: Quest, Encounter, Story Panel, Loot, Character, Player. Never "level", "chapter", "mission", "user", "battle".
- No magic strings compared in production code: as-const objects with derived types; tests may use literals.
- Comments state the constraint, not the investigation. Every exported function gets a one-line docstring (CodeRabbit blocks below 80% coverage).
- No commit trailers or attribution. Conventional subjects. Never `git push`.
- Component test files start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`. Fake-timer tests wrap `vi.advanceTimersByTime` in `act`.
- Content values are exactly the spec's table: seven Encounters, HP 6, 7, 8, 10, 11, 13, 15; slugs `gob-nine`, `fourmidable-knight`, `spinner-six`, `ate-bat`, `tenta-cool`, `odd-owl`, `twelve-headed-hydra`; quest id `fortress-of-twelves`; background `castle-02`; the eight Loot ids and names from the spec.
- Art may be missing for a monster until Brendon commits it; a missing image renders nothing, never a broken icon.

---

### Task 1: Quest 1 content

**Files:**
- Create: `src/content/quest1.ts`, `src/content/quest1.test.ts`
- Modify: `src/content/index.ts` (replace the `QUEST_1_FIRST` definition with a re-export)

**Interfaces:**
- Consumes: `EncounterTemplate` from `src/content/index.ts`.
- Produces: `StoryPanel`, `QuestEncounter`, `Quest`, `LOOT`, `QUEST_1`, `QUEST_1_FIRST`, `findTemplate(questId, monsterId): QuestEncounter | null`.

- [ ] **Step 1: Write the failing tests**

`src/content/quest1.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { findTemplate, LOOT, QUEST_1, QUEST_1_FIRST } from './quest1';

const sentences = (text: string) => text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;

describe('Quest 1 content', () => {
  it('has seven Encounters with HP climbing from 6 to 15', () => {
    const hp = QUEST_1.encounters.map((e) => e.monsterMaxHp);
    expect(hp).toEqual([6, 7, 8, 10, 11, 13, 15]);
    expect(QUEST_1.id).toBe('fortress-of-twelves');
    expect(QUEST_1.name).toBe('The Fortress of Twelves');
    expect(QUEST_1.background).toBe('castle-02');
  });

  it('names the monsters in order with unique slugs', () => {
    expect(QUEST_1.encounters.map((e) => e.monsterId)).toEqual([
      'gob-nine', 'fourmidable-knight', 'spinner-six', 'ate-bat', 'tenta-cool', 'odd-owl', 'twelve-headed-hydra',
    ]);
    expect(new Set(QUEST_1.encounters.map((e) => e.monsterId)).size).toBe(7);
    expect(QUEST_1.encounters[0]!.monsterName).toBe('Gob-nine');
    expect(QUEST_1.encounters[6]!.monsterName).toBe('Twelve-Headed Hydra');
  });

  it('keeps every Story Panel to at most two sentences', () => {
    for (const e of QUEST_1.encounters) expect(sentences(e.story.text), e.monsterId).toBeLessThanOrEqual(2);
    expect(sentences(QUEST_1.closing.text)).toBeLessThanOrEqual(2);
    for (const e of QUEST_1.encounters) expect(e.story.text.trim().length).toBeGreaterThan(0);
  });

  it('gives every Encounter the whole eight-item Loot pool', () => {
    expect(Object.keys(LOOT)).toHaveLength(8);
    expect(LOOT['star-hat']).toBe('Star Hat');
    expect(LOOT['owl-feather-quill']).toBe('Owl Feather Quill');
    for (const e of QUEST_1.encounters) {
      expect(e.lootPool).toEqual(Object.keys(LOOT));
      expect(e.questId).toBe(QUEST_1.id);
      expect(e.background).toBe(QUEST_1.background);
    }
  });

  it('resolves every template by quest and monster id, and nothing across quests (invariant 2)', () => {
    for (const e of QUEST_1.encounters) expect(findTemplate(QUEST_1.id, e.monsterId)).toBe(e);
    expect(findTemplate('another-quest', 'gob-nine')).toBeNull();
    expect(findTemplate(QUEST_1.id, 'no-such-monster')).toBeNull();
  });

  it('exposes the first Encounter for existing callers', () => {
    expect(QUEST_1_FIRST).toBe(QUEST_1.encounters[0]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/quest1.test.ts`
Expected: FAIL, cannot resolve `./quest1`.

- [ ] **Step 3: Write the content and the re-export**

`src/content/quest1.ts`:
```ts
import type { EncounterTemplate } from './index';

/** One comic panel of story: at most two sentences, shown before a fight or after the boss. */
export interface StoryPanel {
  text: string;
}

/** An Encounter template plus the Story Panel that introduces it. */
export interface QuestEncounter extends EncounterTemplate {
  story: StoryPanel;
}

/** A hand-authored Quest: ordered Encounters, a shared Loot pool, and a closing panel. */
export interface Quest {
  id: string;
  name: string;
  background: string;
  lootPool: string[];
  encounters: QuestEncounter[];
  closing: StoryPanel;
}

/** Loot ids to display names. Cosmetic only; art and display come with the Loot plan. */
export const LOOT: Record<string, string> = {
  'star-hat': 'Star Hat',
  'moon-hat': 'Moon Hat',
  'nine-eye-monocle': 'Nine-Eye Monocle',
  'rusty-gauntlet': 'Rusty Gauntlet',
  'spider-silk-scarf': 'Spider-Silk Scarf',
  'bat-wing-cloak': 'Bat-Wing Cloak',
  'ink-staff': 'Ink Staff',
  'owl-feather-quill': 'Owl Feather Quill',
};

const QUEST_ID = 'fortress-of-twelves';
const BACKGROUND = 'castle-02';
const LOOT_POOL = Object.keys(LOOT);

const encounter = (monsterId: string, monsterName: string, monsterMaxHp: number, text: string): QuestEncounter => ({
  questId: QUEST_ID, monsterId, monsterName, monsterMaxHp, lootPool: LOOT_POOL, background: BACKGROUND, story: { text },
});

/** Quest 1: seven fights up the hill to the Twelve-Headed Hydra, HP 6 to 15. */
export const QUEST_1: Quest = {
  id: QUEST_ID,
  name: 'The Fortress of Twelves',
  background: BACKGROUND,
  lootPool: LOOT_POOL,
  encounters: [
    encounter('gob-nine', 'Gob-nine', 6, 'The Twelve-Headed Hydra smashed the Fortress of Twelves and scattered the Great Times Table. A goblin with nine eyes guards the first stone.'),
    encounter('fourmidable-knight', 'The Fourmidable Knight', 7, 'A rusty knight blocks the path with four arms and four swords. He has never lost a fight, mostly because nobody can count his hits.'),
    encounter('spinner-six', 'Spinner Six', 8, 'A giant spider drops from the gate with only six legs. Do not mention the missing two.'),
    encounter('ate-bat', 'The Ate-Bat', 10, 'In the courtyard a fat bat with eight wings is eating numbers off the wall. It burps a seven.'),
    encounter('tenta-cool', 'Tenta-Cool', 11, 'A ten-armed squid in sunglasses lounges in the moat. It offers to fight you with one arm tied behind its back.'),
    encounter('odd-owl', 'The Odd Owl', 13, 'High in the tower an owl hoots eleven times and glares at every even number. It has been waiting all night.'),
    encounter('twelve-headed-hydra', 'Twelve-Headed Hydra', 15, 'At the top, twelve heads argue about the answer to everything. They all turn to look at you at once.'),
  ],
  closing: { text: "The Great Times Table is whole again and the Fortress lights up window by window. The Hydra's heads agree on one thing: leave." },
};

/** The first Encounter of Quest 1, kept for callers that predate the Quest screen. */
export const QUEST_1_FIRST: QuestEncounter = QUEST_1.encounters[0]!;

const QUESTS: Quest[] = [QUEST_1];

/** Resolves a saved Encounter's template by quest and monster id; null when content no longer has it. */
export function findTemplate(questId: string, monsterId: string): QuestEncounter | null {
  return QUESTS.find((q) => q.id === questId)?.encounters.find((e) => e.monsterId === monsterId) ?? null;
}
```

In `src/content/index.ts`, delete the whole `export const QUEST_1_FIRST: EncounterTemplate = { ... };` block and add at the end:
```ts
export { QUEST_1_FIRST } from './quest1';
```
(`quest1.ts` imports only a type from `index.ts`, so there is no runtime cycle.)

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/content/quest1.test.ts && npm test && npm run typecheck`
Expected: 6 tests pass in the file; suite green (existing callers of `QUEST_1_FIRST` unchanged); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/content/quest1.ts src/content/quest1.test.ts src/content/index.ts
git commit -m "feat: Quest 1 content: seven Encounters, Story Panels, Loot pool, template lookup"
```

---

### Task 2: Quest progress

**Files:**
- Create: `src/game/quest.ts`, `src/game/quest.test.ts`

**Interfaces:**
- Consumes: `Quest` from `src/content/quest1.ts`; `EncounterStatus` from `src/engine/combat.ts`; `SaveData` from `src/storage/save.ts`; for the invariant test, `beginEncounter`, `nextProblem`, `cast` from `src/game/play.ts`.
- Produces: `EncounterState` const object and type; `questProgress(save, quest): EncounterState[]`; `questComplete(save, quest): boolean`; `nextOpenIndex(save, quest): number`.

- [ ] **Step 1: Write the failing tests**

`src/game/quest.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { EncounterState, nextOpenIndex, questComplete, questProgress } from './quest';
import { beginEncounter, cast, nextProblem } from './play';
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const record = (monsterId: string, status: EncounterRecord['status'], questId = QUEST_1.id): EncounterRecord => ({
  id: `${monsterId}-${status}`, questId, monsterId, monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status, xp: 0, loot: null,
});
const withRecords = (...records: EncounterRecord[]): SaveData => ({ ...base(), encounters: records });

describe('questProgress', () => {
  it('opens only the first Encounter for a new Player', () => {
    expect(questProgress(base(), QUEST_1)).toEqual([
      EncounterState.Open, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked, EncounterState.Locked,
    ]);
    expect(nextOpenIndex(base(), QUEST_1)).toBe(0);
    expect(questComplete(base(), QUEST_1)).toBe(false);
  });

  it('a won Encounter stays Won and opens the next', () => {
    const save = withRecords(record('gob-nine', EncounterStatus.Won));
    expect(questProgress(save, QUEST_1).slice(0, 3)).toEqual([EncounterState.Won, EncounterState.Open, EncounterState.Locked]);
    expect(nextOpenIndex(save, QUEST_1)).toBe(1);
  });

  it('ignores Retreats and records from another Quest', () => {
    const save = withRecords(record('gob-nine', EncounterStatus.Retreated), record('gob-nine', EncounterStatus.Won, 'another-quest'));
    expect(questProgress(save, QUEST_1)[0]).toBe(EncounterState.Open);
  });

  it('is complete only when the boss is won, and then focuses the boss', () => {
    const allButBoss = withRecords(...QUEST_1.encounters.slice(0, 6).map((e) => record(e.monsterId, EncounterStatus.Won)));
    expect(questComplete(allButBoss, QUEST_1)).toBe(false);
    expect(nextOpenIndex(allButBoss, QUEST_1)).toBe(6);
    const all = withRecords(...QUEST_1.encounters.map((e) => record(e.monsterId, EncounterStatus.Won)));
    expect(questComplete(all, QUEST_1)).toBe(true);
    expect(questProgress(all, QUEST_1).every((s) => s === EncounterState.Won)).toBe(true);
    expect(nextOpenIndex(all, QUEST_1)).toBe(6);
  });
});

describe('playing the Quest in order through play.ts (invariant 1)', () => {
  it('opens each Encounter exactly when the previous is won and completes on the boss', () => {
    let save = base();
    const rng = () => 0.5;
    QUEST_1.encounters.forEach((template, i) => {
      expect(questProgress(save, QUEST_1)[i]).toBe(EncounterState.Open);
      let { save: s, encounter } = beginEncounter(save, template, NOW, `q${i}`);
      save = s;
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, NOW, rng);
        ({ save, encounter } = cast(save, encounter, template, p, p.answer, 1000, NOW, rng));
      }
      expect(encounter.status).toBe(EncounterStatus.Won);
      expect(questProgress(save, QUEST_1)[i]).toBe(EncounterState.Won);
      if (i < 6) expect(questProgress(save, QUEST_1)[i + 1]).toBe(EncounterState.Open);
    });
    expect(questComplete(save, QUEST_1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/quest.test.ts`
Expected: FAIL, cannot resolve `./quest`.

- [ ] **Step 3: Implement**

`src/game/quest.ts`:
```ts
import type { Quest } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import type { SaveData } from '../storage/save';

export const EncounterState = { Locked: 'locked', Open: 'open', Won: 'won' } as const;
export type EncounterState = (typeof EncounterState)[keyof typeof EncounterState];

/** Derives each Encounter's state from the save's records: Won, the first not-won is Open, the rest Locked. */
export function questProgress(save: SaveData, quest: Quest): EncounterState[] {
  const won = new Set(
    save.encounters.filter((r) => r.questId === quest.id && r.status === EncounterStatus.Won).map((r) => r.monsterId),
  );
  let opened = false;
  return quest.encounters.map((e) => {
    if (won.has(e.monsterId)) return EncounterState.Won;
    if (opened) return EncounterState.Locked;
    opened = true;
    return EncounterState.Open;
  });
}

/** True once every Encounter, the boss included, has been won. */
export const questComplete = (save: SaveData, quest: Quest): boolean =>
  questProgress(save, quest).every((s) => s === EncounterState.Won);

/** The row to focus on the Quest screen: the first open Encounter, or the boss once the Quest is complete. */
export function nextOpenIndex(save: SaveData, quest: Quest): number {
  const i = questProgress(save, quest).indexOf(EncounterState.Open);
  return i === -1 ? quest.encounters.length - 1 : i;
}
```

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/game/quest.test.ts && npm test && npm run typecheck`
Expected: 5 tests pass in the file; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/quest.ts src/game/quest.test.ts
git commit -m "feat: Quest progress derived from Encounter records"
```

---

### Task 3: Quest, story, and closing screens; result label; tolerant monster art

**Files:**
- Create: `src/ui/MonsterArt.tsx`, `src/ui/MonsterArt.test.tsx`, `src/ui/QuestScreen.tsx`, `src/ui/QuestScreen.test.tsx`, `src/ui/StoryPanelScreen.tsx`, `src/ui/StoryPanelScreen.test.tsx`, `src/ui/ClosingPanelScreen.tsx`
- Modify: `src/ui/EncounterScreen.tsx` (use `MonsterArt`), `src/ui/ResultScreen.tsx`, `src/ui/ResultScreen.test.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `Quest`, `QuestEncounter` from `src/content/quest1.ts`; `EncounterState`, `questProgress`, `nextOpenIndex` from `src/game/quest.ts`; `MonsterPips` from `src/ui/Hp.tsx`; `art` from `src/ui/art.ts`.
- Produces: `MonsterArt({ monsterId })`; `QuestScreen({ save, quest, onPick, onTitle })`; `StoryPanelScreen({ quest, encounter, onFight })`; `ClosingPanelScreen({ quest, onTitle })`; `ResultScreen` prop `continueLabel?: string` (default `'Fight again'`).

- [ ] **Step 1: Write the failing tests**

`src/ui/MonsterArt.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MonsterArt } from './MonsterArt';

afterEach(cleanup);

describe('MonsterArt', () => {
  it('renders the monster image and removes it when the file is missing', () => {
    const { container } = render(<MonsterArt monsterId="odd-owl" />);
    const img = container.querySelector('img.monster') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('art/monster/odd-owl.png');
    fireEvent.error(img);
    expect(container.querySelector('img.monster')).toBeNull();
  });
});
```

`src/ui/QuestScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QuestScreen } from './QuestScreen';
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

afterEach(cleanup);

const NOW = '2026-09-16T12:00:00.000Z';
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const won = (monsterId: string): EncounterRecord => ({
  id: monsterId, questId: QUEST_1.id, monsterId, monsterMaxHp: 6, startedAt: NOW, endedAt: NOW, status: EncounterStatus.Won, xp: 12, loot: null,
});
const row = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('QuestScreen', () => {
  it('lists seven Encounters, focuses the first open one, and disables locked ones', () => {
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} />);
    expect(screen.getByRole('heading').textContent).toBe('The Fortress of Twelves');
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(document.activeElement).toBe(row(/Gob-nine/));
    expect(row(/Gob-nine/).disabled).toBe(false);
    expect(row(/Fourmidable Knight/).disabled).toBe(true);
    expect(row(/Fourmidable Knight/).textContent).toContain('Locked');
    expect(row(/Twelve-Headed Hydra/).disabled).toBe(true);
  });

  it('marks a won Encounter, keeps it playable, and focuses the newly opened one', () => {
    const onPick = vi.fn();
    render(<QuestScreen save={{ ...base(), encounters: [won('gob-nine')] }} quest={QUEST_1} onPick={onPick} onTitle={() => {}} />);
    expect(row(/Gob-nine/).textContent).toContain('Won');
    expect(row(/Gob-nine/).disabled).toBe(false);
    expect(document.activeElement).toBe(row(/Fourmidable Knight/));
    fireEvent.click(row(/Gob-nine/));
    expect(onPick).toHaveBeenCalledWith(0);
    fireEvent.click(row(/Fourmidable Knight/));
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('shows each monster's max HP as pips and offers Title', () => {
    const onTitle = vi.fn();
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={onTitle} />);
    expect(screen.getByLabelText('15 of 15 monster hit points')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalled();
  });
});
```

`src/ui/StoryPanelScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClosingPanelScreen } from './ClosingPanelScreen';
import { StoryPanelScreen } from './StoryPanelScreen';
import { QUEST_1 } from '../content/quest1';

afterEach(cleanup);

describe('StoryPanelScreen', () => {
  it('shows the panel text over the Quest background with the monster, and focuses Fight', () => {
    const onFight = vi.fn();
    const knight = QUEST_1.encounters[1]!;
    const { container } = render(<StoryPanelScreen quest={QUEST_1} encounter={knight} onFight={onFight} />);
    expect(screen.getByText(knight.story.text)).toBeTruthy();
    expect((container.querySelector('.panel') as HTMLElement).style.backgroundImage).toContain('castle-02');
    expect((container.querySelector('img.monster') as HTMLImageElement).getAttribute('src')).toContain('fourmidable-knight');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
    expect(onFight).toHaveBeenCalled();
  });
});

describe('ClosingPanelScreen', () => {
  it('shows the closing text and focuses Title', () => {
    const onTitle = vi.fn();
    render(<ClosingPanelScreen quest={QUEST_1} onTitle={onTitle} />);
    expect(screen.getByText(QUEST_1.closing.text)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Title' }));
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalled();
  });
});
```

Add to `src/ui/ResultScreen.test.tsx`, inside `describe('ResultScreen')`, after the existing test (reuse its setup by copying the four lines that build `save` and `encounter`):
```tsx
  it('labels the primary button as asked, defaulting to Fight again', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} continueLabel="Continue" />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('button', { name: 'Fight again' })).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/MonsterArt.test.tsx src/ui/QuestScreen.test.tsx src/ui/StoryPanelScreen.test.tsx src/ui/ResultScreen.test.tsx`
Expected: FAIL, modules missing; the ResultScreen label test fails on the button name.

- [ ] **Step 3: Implement**

`src/ui/MonsterArt.tsx`:
```tsx
import { useState } from 'react';
import { art } from './art';

/** The monster's image; renders nothing once the file fails to load, so unshipped art never shows a broken icon. */
export function MonsterArt({ monsterId }: { monsterId: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img className="monster" src={art(`monster/${monsterId}.png`)} alt="" onError={() => setMissing(true)} />;
}
```

In `src/ui/EncounterScreen.tsx`: add `import { MonsterArt } from './MonsterArt';` and replace
```tsx
        <img className="monster" src={art(`monster/${e.spec.monsterId}.png`)} alt="" />
```
with
```tsx
        <MonsterArt monsterId={e.spec.monsterId} />
```
(`art` is still used for the portrait and background; keep its import.)

`src/ui/QuestScreen.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import type { Quest } from '../content/quest1';
import { EncounterState, nextOpenIndex, questProgress } from '../game/quest';
import type { SaveData } from '../storage/save';
import { MonsterPips } from './Hp';

interface QuestScreenProps {
  save: SaveData;
  quest: Quest;
  onPick: (index: number) => void;
  onTitle: () => void;
}

const STATE_LABEL: Record<EncounterState, string> = {
  [EncounterState.Won]: 'Won',
  [EncounterState.Open]: '',
  [EncounterState.Locked]: 'Locked',
};

/** The Quest's Encounters in order; locked rows are disabled and the next open row starts focused. */
export function QuestScreen({ save, quest, onPick, onTitle }: QuestScreenProps) {
  const progress = questProgress(save, quest);
  const focusIndex = nextOpenIndex(save, quest);
  const focused = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focused.current?.focus();
  }, []);
  return (
    <main className="screen quest">
      <h1>{quest.name}</h1>
      <ol className="quest-list">
        {quest.encounters.map((e, i) => (
          <li key={e.monsterId}>
            <button
              type="button"
              className="quest-row"
              ref={i === focusIndex ? focused : undefined}
              disabled={progress[i] === EncounterState.Locked}
              onClick={() => onPick(i)}
            >
              <span className="quest-name">{e.monsterName}</span>
              <MonsterPips hp={e.monsterMaxHp} maxHp={e.monsterMaxHp} />
              <span className="quest-state">{STATE_LABEL[progress[i]!]}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onTitle}>Title</button>
    </main>
  );
}
```

`src/ui/StoryPanelScreen.tsx`:
```tsx
import type { Quest, QuestEncounter } from '../content/quest1';
import { art } from './art';
import { MonsterArt } from './MonsterArt';

interface StoryPanelScreenProps {
  quest: Quest;
  encounter: QuestEncounter;
  onFight: () => void;
}

/** The comic panel before a fight: Quest background, the monster, two sentences, and a focused Fight button. */
export function StoryPanelScreen({ quest, encounter, onFight }: StoryPanelScreenProps) {
  return (
    <main className="screen story">
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${quest.background}.png`)})` }}>
        <MonsterArt monsterId={encounter.monsterId} />
        <p className="story-text">{encounter.story.text}</p>
      </section>
      <button type="button" className="primary" onClick={onFight} autoFocus>Fight</button>
    </main>
  );
}
```

`src/ui/ClosingPanelScreen.tsx`:
```tsx
import type { Quest } from '../content/quest1';
import { art } from './art';

/** The panel after the boss falls: the Quest background, the closing text, and a focused Title button. */
export function ClosingPanelScreen({ quest, onTitle }: { quest: Quest; onTitle: () => void }) {
  return (
    <main className="screen story">
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${quest.background}.png`)})` }}>
        <p className="story-text">{quest.closing.text}</p>
      </section>
      <button type="button" className="primary" onClick={onTitle} autoFocus>Title</button>
    </main>
  );
}
```

In `src/ui/ResultScreen.tsx`: add `continueLabel?: string;` to `ResultScreenProps`, destructure `continueLabel = 'Fight again'`, and change the primary button's text to `{continueLabel}`. Update the docstring to say the primary button is focused.

Append to `src/ui/styles.css`:
```css
.quest-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; width: 100%; max-width: 640px; }
.quest-row { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; text-align: left; }
.quest-name { font-weight: 700; }
.quest-state { min-width: 5ch; text-align: right; }
.story .panel { width: 100%; max-width: 900px; }
.story-text {
  position: absolute;
  inset: auto 0 0 0;
  margin: 0;
  padding: 16px 24px;
  font-size: 1.25rem;
  background: rgb(255 255 255 / 0.92);
  border-top: 4px solid var(--frame);
}
```

- [ ] **Step 4: Run the files, the suite, and typecheck**

Run: `npx vitest run src/ui/MonsterArt.test.tsx src/ui/QuestScreen.test.tsx src/ui/StoryPanelScreen.test.tsx src/ui/ResultScreen.test.tsx && npm test && npm run typecheck`
Expected: 1, 3, 2, and 2 tests pass in the four files; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/MonsterArt.tsx src/ui/MonsterArt.test.tsx src/ui/QuestScreen.tsx src/ui/QuestScreen.test.tsx src/ui/StoryPanelScreen.tsx src/ui/StoryPanelScreen.test.tsx src/ui/ClosingPanelScreen.tsx src/ui/EncounterScreen.tsx src/ui/ResultScreen.tsx src/ui/ResultScreen.test.tsx src/ui/styles.css
git commit -m "feat: Quest screen, Story Panels, closing panel, and tolerant monster art"
```

---

### Task 4: App flow through the Quest

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `QUEST_1`, `findTemplate`, `QuestEncounter` from `src/content/quest1.ts`; `questComplete` from `src/game/quest.ts`; the three screens from Task 3; `ResultScreen`'s `continueLabel`.
- Produces: `Screen` gains `Quest`, `Story`, `Closing`. Play opens the Quest screen; Continue resumes; templates resolve through `findTemplate`.

- [ ] **Step 1: Write the failing tests**

In `src/App.test.tsx`:

Replace the test `shows the title with Play for an existing Character, and Play opens an Encounter` with:
```tsx
  it('Play opens the Quest screen; picking Gob-nine shows its Story Panel; Fight opens the Encounter', async () => {
    const store = memoryStore();
    await store.save(named());
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    expect(await screen.findByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Gob-nine/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gob-nine/ }));
    expect(screen.getByText(QUEST_1.encounters[0]!.story.text)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
    expect(await screen.findByLabelText('Answer')).toBeTruthy();
    expect(screen.getByText('Gob-nine')).toBeTruthy();
    expect((await store.load())?.activeEncounter?.spec.monsterId).toBe('gob-nine');
  });

  it('a won fight leads through Continue to the Quest screen with the next row focused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const store = memoryStore();
      await store.save(named());
      render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
      fireEvent.click(await screen.findByRole('button', { name: /Gob-nine/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
      await screen.findByLabelText('Answer');
      for (let i = 0; i < 3; i++) {
        const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
        for (const d of String(a! * b!)) fireEvent.click(screen.getByRole('button', { name: d }));
        fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
        act(() => { vi.advanceTimersByTime(1500); });
      }
      expect(screen.getByRole('heading').textContent).toBe('Victory!');
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('heading', { name: 'The Fortress of Twelves' })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Fourmidable Knight/ }));
      expect(screen.getByRole('button', { name: /Gob-nine/ }).textContent).toContain('Won');
    } finally {
      vi.useRealTimers();
    }
  });

  it('winning the boss leads to the closing panel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const store = memoryStore();
      const NOW = new Date().toISOString();
      const won = QUEST_1.encounters.slice(0, 6).map((e) => ({
        id: e.monsterId, questId: QUEST_1.id, monsterId: e.monsterId, monsterMaxHp: e.monsterMaxHp,
        startedAt: NOW, endedAt: NOW, status: 'won' as const, xp: 0, loot: null,
      }));
      await store.save({ ...named(), encounters: won });
      render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
      expect(document.activeElement).toBe(await screen.findByRole('button', { name: /Twelve-Headed Hydra/ }));
      fireEvent.click(screen.getByRole('button', { name: /Twelve-Headed Hydra/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
      await screen.findByLabelText('Answer');
      for (let i = 0; i < 8; i++) {
        const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
        for (const d of String(a! * b!)) fireEvent.click(screen.getByRole('button', { name: d }));
        fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
        act(() => { vi.advanceTimersByTime(1500); });
      }
      expect(screen.getByRole('heading').textContent).toBe('Victory!');
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByText(QUEST_1.closing.text)).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Title' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes a saved Knight fight with the Knight, and fails plainly on a monster content no longer has', async () => {
    const knight = QUEST_1.encounters[1]!;
    const store = memoryStore();
    await store.save(beginEncounter(named(), knight, new Date(), 'k1').save);
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('The Fourmidable Knight')).toBeTruthy();
    expect(screen.getByLabelText('7 of 7 monster hit points')).toBeTruthy();
    cleanup();
    const gone = beginEncounter(named(), { ...knight, monsterId: 'retired-monster' }, new Date(), 'k2').save;
    const store2 = memoryStore();
    await store2.save(gone);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App store={store2} />);
    expect(await screen.findByText('The save could not be read.')).toBeTruthy();
    spy.mockRestore();
  });
```
Add `QUEST_1` to the content import: `import { APP_TITLE, QUEST_1_FIRST } from './content';` becomes `import { APP_TITLE, QUEST_1_FIRST } from './content';` plus `import { QUEST_1 } from './content/quest1';`.

The existing `resumes at the title with Continue` test still passes: Continue resumes the saved Gob-nine fight.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL on the four new tests (no Quest heading, no Continue label, no closing panel, unknown monster not rejected).

- [ ] **Step 3: Implement**

In `src/App.tsx`:

Imports: replace `import { PLAYER_ID, QUEST_1_FIRST } from './content';` with
```ts
import { PLAYER_ID } from './content';
import { findTemplate, QUEST_1, type QuestEncounter } from './content/quest1';
import { questComplete } from './game/quest';
import { ClosingPanelScreen } from './ui/ClosingPanelScreen';
import { QuestScreen } from './ui/QuestScreen';
import { StoryPanelScreen } from './ui/StoryPanelScreen';
```

`Screen`:
```ts
const Screen = {
  Title: 'title', Create: 'create', Quest: 'quest', Story: 'story', Encounter: 'encounter', Result: 'result',
  Closing: 'closing', Survival: 'survival', SurvivalResult: 'survival-result',
} as const;
```

State: add `const [pick, setPick] = useState<QuestEncounter>(QUEST_1.encounters[0]!);` after `encounter`.

Add a resolver above `persist`:
```ts
  // Every saved Encounter must map back to content; a spec that no longer resolves is treated as corrupt data.
  const templateFor = (e: Encounter): QuestEncounter => findTemplate(e.spec.questId, e.spec.monsterId)!;
```

Replace `play`:
```ts
  // Play opens the Quest; Continue resumes the open Encounter without re-beginning it, so a reload never loses a fight.
  const play = (data: SaveData) => {
    if (data.activeEncounter) {
      setXpBefore(data.character.xp);
      setEncounter(data.activeEncounter);
      setScreen(Screen.Encounter);
    } else {
      setScreen(Screen.Quest);
    }
  };

  const fight = (data: SaveData, template: QuestEncounter) => {
    setXpBefore(data.character.xp);
    const begun = beginEncounter(data, template, now());
    persist(begun.save);
    setEncounter(begun.encounter);
    setScreen(Screen.Encounter);
  };
```

In the load effect, after `setSave(data);`:
```ts
      if (data.activeEncounter && !findTemplate(data.activeEncounter.spec.questId, data.activeEncounter.spec.monsterId)) {
        console.error('load failed', new Error(`Unknown Encounter ${data.activeEncounter.spec.questId}/${data.activeEncounter.spec.monsterId}`));
        setLoadFailed(true);
        return;
      }
```

Switch cases: add before `Screen.Encounter`:
```tsx
    case Screen.Quest:
      return <QuestScreen save={save} quest={QUEST_1} onPick={(i) => { setPick(QUEST_1.encounters[i]!); setScreen(Screen.Story); }} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Story:
      return <StoryPanelScreen quest={QUEST_1} encounter={pick} onFight={() => fight(save, pick)} />;
    case Screen.Closing:
      return <ClosingPanelScreen quest={QUEST_1} onTitle={() => setScreen(Screen.Title)} />;
```
In `Screen.Encounter`, change `template={QUEST_1_FIRST}` to `template={templateFor(encounter!)}`.
In `Screen.Result`, change the `ResultScreen` element to:
```tsx
      return (
        <ResultScreen
          save={save}
          encounter={encounter!}
          xpBefore={xpBefore}
          continueLabel="Continue"
          onAgain={() => setScreen(questComplete(save, QUEST_1) && encounter!.spec.monsterId === QUEST_1.encounters[6]!.monsterId ? Screen.Closing : Screen.Quest)}
          onTitle={() => setScreen(Screen.Title)}
          saveFailed={saveFailed}
        />
      );
```
Leave the Survival cases as they are for this task (`QUEST_1_FIRST` import is no longer needed in App once Task 5 lands; until then import it from `./content/quest1` for the Survival case: `import { findTemplate, QUEST_1, QUEST_1_FIRST, type QuestEncounter } from './content/quest1';`).

- [ ] **Step 4: Run the file, the suite, typecheck, and the build**

Run: `npx vitest run src/App.test.tsx && npm test && npm run typecheck && npm run build`
Expected: 13 tests pass in the file; suite green; typecheck clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: Play walks Quest 1 through the Quest screen and Story Panels; templates resolve from the save"
```

---

### Task 5: Survival walks the roster; glossary; spec sync

**Files:**
- Modify: `src/game/survival.ts`, `src/game/survival.test.ts`, `src/ui/SurvivalScreen.tsx`, `src/ui/SurvivalScreen.test.tsx`, `src/App.tsx`, `CONTEXT.md`, `docs/superpowers/specs/2026-09-16-quest-1-content-design.md`

**Interfaces:**
- Consumes: `QUEST_1` from `src/content/quest1.ts`; `EncounterTemplate` from `src/game/play.ts`.
- Produces: `rosterIndex(wins, length): number` in `survival.ts`; `SurvivalScreen` prop `roster: EncounterTemplate[]` replacing `template`.

- [ ] **Step 1: Write the failing tests**

Add to `src/game/survival.test.ts` (import `rosterIndex` from `./survival`):
```ts
describe('rosterIndex', () => {
  it('walks the roster with each win and wraps, never leaving the roster (invariant 3)', () => {
    expect(rosterIndex(0, 7)).toBe(0);
    expect(rosterIndex(6, 7)).toBe(6);
    expect(rosterIndex(7, 7)).toBe(0);
    for (let wins = 0; wins <= 100; wins++) {
      const i = rosterIndex(wins, 7);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(6);
    }
  });
});
```

In `src/ui/SurvivalScreen.test.tsx`:
- Change the import of `QUEST_1_FIRST` to `import { QUEST_1 } from '../content/quest1';` and in `mount` replace `template={QUEST_1_FIRST}` with `roster={QUEST_1.encounters}`.
- In `flashes the win, then starts the next fight with a healed monster`, replace `expect(screen.getByLabelText('6 of 6 monster hit points')).toBeTruthy();` with:
```tsx
    expect(screen.getByText('The Fourmidable Knight')).toBeTruthy();
    expect(screen.getByLabelText('7 of 7 monster hit points')).toBeTruthy();
```
- Add a test:
```tsx
  it('stays on the same monster after a Retreat', () => {
    mount();
    for (let i = 0; i < 5; i++) {
      typeAndCast(currentAnswer() + 1);
      advance(FEEDBACK_MS.miss);
    }
    expect(screen.getByRole('status').textContent).toBe('Retreat. +0 XP');
    advance(FEEDBACK_MS.hit);
    expect(screen.getByText('Gob-nine')).toBeTruthy();
    expect(screen.getByLabelText('6 of 6 monster hit points')).toBeTruthy();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/survival.test.ts src/ui/SurvivalScreen.test.tsx`
Expected: FAIL, `rosterIndex` not exported; `roster` prop unknown / Knight not shown.

- [ ] **Step 3: Implement**

Add to `src/game/survival.ts` after `SURVIVAL_MS`:
```ts
/** Which roster Encounter the run fights next: one step per win, wrapping after the last. */
export const rosterIndex = (wins: number, length: number): number => wins % length;
```

In `src/ui/SurvivalScreen.tsx`:
- Import `rosterIndex` from `../game/survival`.
- Props: replace `template: EncounterTemplate;` with `roster: EncounterTemplate[];` and destructure `roster` instead of `template`.
- Initial state: `const [state, setState] = useState(() => beginEncounter(initial, roster[0]!, now(), undefined));` and add `const [template, setTemplate] = useState<EncounterTemplate>(roster[0]!);`.
- In the flash timeout, replace the `beginEncounter(state.save, template, ...)` call with:
```ts
      const nextTemplate = roster[rosterIndex(run.wins, roster.length)]!;
      setTemplate(nextTemplate);
      const next = beginEncounter(state.save, nextTemplate, now(), undefined);
```
- Keep `template={template}` on the `EncounterScreen` (now the state value).
- Update the component docstring to say the run walks the roster.

In `src/App.tsx`, the Survival case: replace `template={QUEST_1_FIRST}` with `roster={QUEST_1.encounters}` and drop `QUEST_1_FIRST` from the import.

In `CONTEXT.md`, add after the `**Quest**:` entry:
```
**Story Panel**:
One comic panel of story, at most two sentences, shown before an Encounter or after a Quest's boss. Reuses the Quest background and the coming monster's art.
_Avoid_: cutscene, dialogue, intro
```
and extend the Survival entry's first sentence to: "A timed run of back-to-back Encounters that walks the Quest's roster, one monster up per win, wrapping after the boss: five minutes, full HP each fight, no story."

In the spec's Survival section, replace "fight `n` (counting from 0) uses Encounter `n mod 7`" with "the next fight uses Encounter `wins mod 7`, so a Retreat repeats the same monster".

- [ ] **Step 4: Run the files, the suite, typecheck, and the build**

Run: `npx vitest run src/game/survival.test.ts src/ui/SurvivalScreen.test.tsx src/App.test.tsx && npm test && npm run typecheck && npm run build`
Expected: all pass; suite green; typecheck clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/survival.ts src/game/survival.test.ts src/ui/SurvivalScreen.tsx src/ui/SurvivalScreen.test.tsx src/App.tsx CONTEXT.md docs/superpowers/specs/2026-09-16-quest-1-content-design.md
git commit -m "feat: Survival walks the Quest roster; Story Panel in the glossary"
```

---

## Out of scope for this plan (next plans)

1. **Loot art and display**: eight prompts, the drop reveal on the result screen, the Character's collection.
2. **Achievements and trophy case**; **Map** with Fogged regions; **Free Roam** in a completed region.
3. **A second Quest** for multi-digit multiplication, and the Work grid it needs.
4. **Survival roster choice** (only beaten monsters, or a picked start) if the walk proves too hard early.
