# Loot Art and Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drops prefer Loot not yet owned, the result screen reveals the drop, and a Loot screen shows the collection.

**Architecture:** Ownership is derived from won Encounter records (`src/game/loot.ts`, pure); the save shape does not change. `cast` rolls through the new rule. Two small UI additions (a reveal panel on the result screen, a Loot screen) plus a title button, wired in `App`.

**Tech Stack:** React 19, TypeScript 7, Vitest 5 with jsdom and Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-17-loot-display-design.md`. Rules: `docs/design.md`. Vocabulary: `CONTEXT.md`.

## Global Constraints

- TDD is mandatory: failing test first, run it, then code, then run it. Paste RED and GREEN output in reports.
- CONTEXT.md terms: Loot, Encounter, Quest, Character, Player. Never "reward", "drop" as a noun, "item", "gear", "user".
- No magic strings compared in production code; docstrings on every export (CodeRabbit blocks below 80%); comments state constraints.
- No commit trailers or attribution. Conventional subjects. Never `git push`.
- Component test files start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`; fake-timer tests wrap `vi.advanceTimersByTime` in `act`.
- Loot pool and names come from `LOOT` in `src/content/quest1.ts` (eight ids). Art paths are `art/loot/<id>.png` under `import.meta.env.BASE_URL`; a missing file renders nothing.
- Survival templates have empty pools and must keep dropping nothing.

---

### Task 1: Ownership and the drop rule

**Files:**
- Create: `src/game/loot.ts`, `src/game/loot.test.ts`
- Modify: `src/game/play.ts` (`cast` rolls through `rollLootFor`)

**Interfaces:**
- Consumes: `rollLoot`, `EncounterStatus` from `src/engine/combat.ts`; `SaveData`, `EncounterRecord` from `src/storage/save.ts`; for tests `QUEST_1`, `LOOT` from `src/content/quest1.ts`, `survivalRoster` from `src/game/survival.ts`, `beginEncounter`, `nextProblem`, `cast` from `src/game/play.ts`.
- Produces: `ownedLoot(save: SaveData): Set<string>`; `rollLootFor(save: SaveData, pool: string[], rng?: () => number): string | null`.

- [ ] **Step 1: Write the failing tests**

`src/game/loot.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ownedLoot, rollLootFor } from './loot';
import { beginEncounter, cast, nextProblem } from './play';
import { survivalRoster } from './survival';
import { LOOT, QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const record = (id: string, status: EncounterRecord['status'], loot: string | null): EncounterRecord => ({
  id, questId: QUEST_1.id, monsterId: 'gob-nine', monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status, xp: 0, loot,
});
const withRecords = (...records: EncounterRecord[]): SaveData => ({ ...base(), encounters: records });
const POOL = Object.keys(LOOT);

describe('ownedLoot', () => {
  it('is the set of Loot ids on won records, ignoring Retreats and repeats', () => {
    const save = withRecords(record('a', EncounterStatus.Won, 'star-hat'), record('b', EncounterStatus.Won, 'star-hat'), record('c', EncounterStatus.Retreated, null), record('d', EncounterStatus.Won, 'ink-staff'));
    expect([...ownedLoot(save)].sort()).toEqual(['ink-staff', 'star-hat']);
    expect(ownedLoot(base()).size).toBe(0);
  });
});

describe('rollLootFor', () => {
  it('prefers Loot not yet owned, then anything once all is owned, and nothing from an empty pool', () => {
    const owned = withRecords(record('a', EncounterStatus.Won, 'star-hat'));
    expect(rollLootFor(owned, ['star-hat', 'moon-hat'], () => 0)).toBe('moon-hat');
    const all = withRecords(record('a', EncounterStatus.Won, 'star-hat'), record('b', EncounterStatus.Won, 'moon-hat'));
    expect(rollLootFor(all, ['star-hat', 'moon-hat'], () => 0)).toBe('star-hat');
    expect(rollLootFor(base(), [], () => 0)).toBeNull();
  });

  it('never returns an owned id while an unowned one remains (invariant 3)', () => {
    let seed = 11;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let k = 0; k < 200; k++) {
      const ownedIds = POOL.filter(() => rng() < 0.5);
      if (ownedIds.length === POOL.length) continue;
      const save = withRecords(...ownedIds.map((id, i) => record(`r${i}`, EncounterStatus.Won, id)));
      const rolled = rollLootFor(save, POOL, rng)!;
      expect(ownedIds).not.toContain(rolled);
    }
  });
});

describe('drops through play.ts', () => {
  const winOne = (save: SaveData, template: typeof QUEST_1.encounters[number], id: string, rng: () => number) => {
    let { save: s, encounter } = beginEncounter(save, template, NOW, id);
    while (encounter.status === EncounterStatus.Active) {
      const p = nextProblem(s, encounter, NOW, rng);
      ({ save: s, encounter } = cast(s, encounter, template, p, p.answer, 1000, NOW, rng));
    }
    return s;
  };

  it('eight Quest wins from an empty collection own all eight (invariant 1)', () => {
    for (const start of [1, 7, 42]) {
      let seed = start;
      const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      let save = base();
      for (let i = 0; i < 8; i++) save = winOne(save, QUEST_1.encounters[0]!, `w${i}`, rng);
      expect([...ownedLoot(save)].sort()).toEqual([...POOL].sort());
    }
  });

  it('a Survival win never drops Loot (invariant 2)', () => {
    const save = winOne(base(), survivalRoster(QUEST_1)[0]!, 's1', () => 0.5);
    expect(save.encounters[0]!.loot).toBeNull();
    expect(ownedLoot(save).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/game/loot.test.ts`
Expected: FAIL, cannot resolve `./loot`.

- [ ] **Step 3: Implement**

`src/game/loot.ts`:
```ts
import { EncounterStatus, rollLoot } from '../engine/combat';
import type { SaveData } from '../storage/save';

/** Every Loot id the Character has won; ownership is never stored, only derived from won records. */
export function ownedLoot(save: SaveData): Set<string> {
  return new Set(
    save.encounters.filter((r) => r.status === EncounterStatus.Won && r.loot !== null).map((r) => r.loot as string),
  );
}

/** Rolls from the pool's unowned ids while any remain, then from the whole pool; null for an empty pool. */
export function rollLootFor(save: SaveData, pool: string[], rng: () => number = Math.random): string | null {
  const owned = ownedLoot(save);
  const unowned = pool.filter((id) => !owned.has(id));
  return rollLoot(unowned.length ? unowned : pool, rng);
}
```

In `src/game/play.ts`: import `rollLootFor` from `./loot`, remove `rollLoot` from the combat import, and change the `withEncounter` call to `withEncounter(data, next, rollLootFor(data, template.lootPool, rng))`.

- [ ] **Step 4: Run the file, the suite, and typecheck**

Run: `npx vitest run src/game/loot.test.ts && npm test && npm run typecheck`
Expected: 5 tests pass in the file; suite green (the existing `cast` Loot test in `play.test.ts` still passes: a single-item pool with nothing owned rolls that item); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/loot.ts src/game/loot.test.ts src/game/play.ts
git commit -m "feat: drops prefer Loot not yet owned; ownership derived from won records"
```

---

### Task 2: Loot art, the reveal, and the Loot screen

**Files:**
- Create: `src/ui/LootArt.tsx`, `src/ui/LootScreen.tsx`, `src/ui/LootScreen.test.tsx`
- Modify: `src/ui/ResultScreen.tsx`, `src/ui/ResultScreen.test.tsx`, `src/ui/TitleScreen.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `LOOT` from `src/content/quest1.ts`; `ownedLoot` from `src/game/loot.ts`; `art` from `src/ui/art.ts`.
- Produces: `LootArt({ id })`; `interface LootReveal { id: string; name: string; isNew: boolean }`; `ResultScreen` prop `loot?: LootReveal`; `LootScreen({ save, onTitle })`; `TitleScreen` prop `onLoot: () => void` with a "Loot" button.

- [ ] **Step 1: Write the failing tests**

`src/ui/LootScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LootScreen } from './LootScreen';
import { LootArt } from './LootArt';
import { LOOT, QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

afterEach(cleanup);

const NOW = '2026-09-17T12:00:00.000Z';
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const won = (id: string, loot: string): EncounterRecord => ({
  id, questId: QUEST_1.id, monsterId: 'gob-nine', monsterMaxHp: 6, startedAt: NOW, endedAt: NOW, status: EncounterStatus.Won, xp: 12, loot,
});

describe('LootArt', () => {
  it('renders the image and removes it when the file is missing', () => {
    const { container } = render(<LootArt id="star-hat" />);
    const img = container.querySelector('img.loot') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('art/loot/star-hat.png');
    fireEvent.error(img);
    expect(container.querySelector('img.loot')).toBeNull();
  });
});

describe('LootScreen', () => {
  it('shows eight slots, names only the owned ones, counts them, and focuses Title (invariant 4)', () => {
    const onTitle = vi.fn();
    const save = { ...base(), encounters: [won('a', 'star-hat'), won('b', 'ink-staff'), won('c', 'star-hat')] };
    render(<LootScreen save={save} onTitle={onTitle} />);
    expect(screen.getByRole('heading').textContent).toBe('Loot');
    expect(screen.getByText('2 of 8')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('Star Hat')).toBeTruthy();
    expect(screen.getByText('Ink Staff')).toBeTruthy();
    expect(screen.queryByText('Moon Hat')).toBeNull();
    expect(screen.getAllByText('?')).toHaveLength(6);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Title' }));
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalled();
  });

  it('shows every name once all eight are owned', () => {
    const save = { ...base(), encounters: Object.keys(LOOT).map((id, i) => won(`w${i}`, id)) };
    render(<LootScreen save={save} onTitle={() => {}} />);
    expect(screen.getByText('8 of 8')).toBeTruthy();
    for (const name of Object.values(LOOT)) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByText('?')).toBeNull();
  });
});
```

Add to `src/ui/ResultScreen.test.tsx` inside `describe('ResultScreen')` (the file already imports `beginEncounter`, `cast`, `nextProblem`, `QUEST_1_FIRST`, `emptySave`, `withCharacter`, `NOW`):
```tsx
  it('reveals the Loot found with a New! badge on a first find, and nothing without a drop (invariant 5)', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    const { unmount } = render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} loot={{ id: 'star-hat', name: 'Star Hat', isNew: true }} />);
    expect(screen.getByText('You found the Star Hat!')).toBeTruthy();
    expect(screen.getByText('New!')).toBeTruthy();
    unmount();
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} loot={{ id: 'star-hat', name: 'Star Hat', isNew: false }} />);
    expect(screen.getByText('You found the Star Hat!')).toBeTruthy();
    expect(screen.queryByText('New!')).toBeNull();
    cleanup();
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.queryByText(/You found/)).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/LootScreen.test.tsx src/ui/ResultScreen.test.tsx`
Expected: FAIL, modules missing; the reveal test fails on "You found".

- [ ] **Step 3: Implement**

`src/ui/LootArt.tsx`:
```tsx
import { useState } from 'react';
import { art } from './art';

/** A Loot item's image; renders nothing once the file fails to load, so unshipped art never shows a broken icon. */
export function LootArt({ id }: { id: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img className="loot" src={art(`loot/${id}.png`)} alt="" onError={() => setMissing(true)} />;
}
```

`src/ui/LootScreen.tsx`:
```tsx
import { LOOT } from '../content/quest1';
import { ownedLoot } from '../game/loot';
import type { SaveData } from '../storage/save';
import { LootArt } from './LootArt';

/** The collection: every Loot in the pool as a slot, owned ones in colour with a name, the rest a silhouette. */
export function LootScreen({ save, onTitle }: { save: SaveData; onTitle: () => void }) {
  const owned = ownedLoot(save);
  const ids = Object.keys(LOOT);
  return (
    <main className="screen loot-screen">
      <h1>Loot</h1>
      <p>{owned.size} of {ids.length}</p>
      <ul className="loot-grid">
        {ids.map((id) => (
          <li key={id} className={owned.has(id) ? 'loot-slot' : 'loot-slot unowned'}>
            <LootArt id={id} />
            {owned.has(id) ? <span className="loot-name">{LOOT[id]}</span> : <span className="loot-mark">?</span>}
          </li>
        ))}
      </ul>
      <button type="button" className="primary" onClick={onTitle} autoFocus>Title</button>
    </main>
  );
}
```

In `src/ui/ResultScreen.tsx`: import `LootArt`; add the type and prop:
```ts
/** What the result screen reveals after a Quest win: the Loot id, its display name, and whether it is a first find. */
export interface LootReveal {
  id: string;
  name: string;
  isNew: boolean;
}
```
`loot?: LootReveal;` in the props, destructured; render after the `Level` line and before the buttons:
```tsx
      {loot && (
        <section className="reveal">
          <LootArt id={loot.id} />
          <p>You found the {loot.name}!{loot.isNew && <span className="badge">New!</span>}</p>
        </section>
      )}
```
Note: keep `You found the {loot.name}!` as one text node so `getByText('You found the Star Hat!')` matches; put the badge inside the same `<p>` after the text.

In `src/ui/TitleScreen.tsx`: add `onLoot: () => void` to the props and destructuring, and between the Play/Continue button and the Survival button add:
```tsx
      <button type="button" onClick={onLoot}>Loot</button>
```

Append to `src/ui/styles.css`:
```css
.reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 24px; border: 4px solid var(--frame); border-radius: 12px; background: #fff; }
.reveal .loot { width: 160px; height: 160px; }
.badge { margin-left: 8px; padding: 2px 10px; border-radius: 999px; background: var(--hit); color: #fff; font-weight: 700; font-size: 0.9rem; }
.loot-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; max-width: 720px; }
.loot-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border: 4px solid var(--frame); border-radius: 12px; background: #fff; min-height: 160px; }
.loot-slot .loot { width: 120px; height: 120px; }
.loot-slot.unowned .loot { filter: brightness(0) opacity(0.25); }
.loot-name { font-weight: 700; text-align: center; }
.loot-mark { font-size: 2rem; font-weight: 700; color: var(--frame); opacity: 0.4; }
@media (max-width: 700px) { .loot-grid { grid-template-columns: repeat(2, 1fr); } }
```

- [ ] **Step 4: Run the files, the suite, and typecheck**

Run: `npx vitest run src/ui/LootScreen.test.tsx src/ui/ResultScreen.test.tsx && npm test && npm run typecheck`
Expected: 3 and 3 tests pass in the two files; suite green; typecheck fails only if `App` does not yet pass `onLoot` (it must compile: add `onLoot={() => {}}` temporarily? No: Task 3 wires it. To keep typecheck green in this task, make `onLoot` optional here: `onLoot?: () => void`, rendering the button only when given. Task 3 passes it.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/LootArt.tsx src/ui/LootScreen.tsx src/ui/LootScreen.test.tsx src/ui/ResultScreen.tsx src/ui/ResultScreen.test.tsx src/ui/TitleScreen.tsx src/ui/styles.css
git commit -m "feat: Loot reveal on the result screen and a Loot collection screen"
```

---

### Task 3: App wiring

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `LootScreen`, `LootReveal`, `ResultScreen`'s `loot` prop, `TitleScreen`'s `onLoot`; `ownedLoot` from `src/game/loot.ts`; `LOOT`, `SURVIVAL_QUEST_ID` from `src/content/quest1.ts`.
- Produces: `Screen.Loot`; the reveal after a won Quest fight.

- [ ] **Step 1: Write the failing tests**

Add to `src/App.test.tsx` (imports: `LOOT` from `./content/quest1` alongside the existing `QUEST_1` import):
```tsx
  it('the title opens the Loot screen with nothing owned, and Title returns', async () => {
    const store = memoryStore();
    await store.save(named());
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Loot' }));
    expect(screen.getByRole('heading', { name: 'Loot' })).toBeTruthy();
    expect(screen.getByText('0 of 8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('a won Quest fight reveals its Loot with New!, and the Loot screen then owns it (invariant 5)', async () => {
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
      const dropped = (await store.load())!.encounters[0]!.loot!;
      expect(screen.getByText(`You found the ${LOOT[dropped]}!`)).toBeTruthy();
      expect(screen.getByText('New!')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Title' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Loot' }));
      expect(screen.getByText('1 of 8')).toBeTruthy();
      expect(screen.getByText(LOOT[dropped]!)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
```
In the existing Retreat test (`five Misses in a row ends in a Retreat`), add after its heading assertion: `expect(screen.queryByText(/You found/)).toBeNull();`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL, no "Loot" button; no reveal.

- [ ] **Step 3: Implement**

In `src/App.tsx`:
- Imports: add `LOOT, SURVIVAL_QUEST_ID` to the `./content/quest1` import; `import { ownedLoot } from './game/loot';`; `import { LootScreen } from './ui/LootScreen';`; `import { ResultScreen, type LootReveal } from './ui/ResultScreen';` (replacing the existing ResultScreen import).
- `Screen` gains `Loot: 'loot'`.
- State: `const [loot, setLoot] = useState<LootReveal | null>(null);`
- Replace the Encounter case's `onFinish` with:
```tsx
          onFinish={(data, finished) => {
            persist(data);
            setEncounter(finished);
            setLoot(revealFor(data, finished));
            setScreen(Screen.Result);
          }}
```
and add above `persist`:
```ts
  // The reveal reads the record just written: a won Quest fight with a drop, never Survival, never a Retreat.
  const revealFor = (data: SaveData, finished: Encounter): LootReveal | null => {
    const record = data.encounters[data.encounters.length - 1];
    if (!record || finished.status !== EncounterStatus.Won || record.questId === SURVIVAL_QUEST_ID || record.loot === null) return null;
    const before = ownedLoot({ ...data, encounters: data.encounters.slice(0, -1) });
    return { id: record.loot, name: LOOT[record.loot] ?? record.loot, isNew: !before.has(record.loot) };
  };
```
- `ResultScreen` gets `loot={loot ?? undefined}`.
- New case before `default`:
```tsx
    case Screen.Loot:
      return <LootScreen save={save} onTitle={() => setScreen(Screen.Title)} />;
```
- `TitleScreen` gets `onLoot={() => setScreen(Screen.Loot)}`.

- [ ] **Step 4: Run the file, the suite, typecheck, and the build**

Run: `npx vitest run src/App.test.tsx && npm test && npm run typecheck && npm run build`
Expected: all pass; suite green; typecheck clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: Loot button on the title and the drop reveal after a Quest win"
```

---

## Out of scope for this plan (next plans)

1. **Achievements and trophy case**, possibly sharing the Loot screen.
2. **Loot on the portrait.**
3. **Per-monster Loot weighting** when a Quest wants themed drops.
