# Achievements and Trophy Case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twenty Achievements derived from the save, a reveal of newly earned ones after a fight, and a Trophy Case screen holding the Loot grid and the Achievement list.

**Architecture:** `src/game/achievements.ts` is pure: one chronological pass over Attempts (with per-Fact mastery recomputed for the Fact just attempted) plus the Encounter records. Nothing is stored. The Loot screen becomes the Trophy Case; both result screens list newly earned Achievements; `App` keeps the save at Encounter start to diff against.

**Tech Stack:** React 19, TypeScript 7, Vitest 5 with jsdom and Testing Library. No new dependencies, no art.

**Spec:** `docs/superpowers/specs/2026-09-17-achievements-design.md`. Rules: `docs/design.md`. Vocabulary: `CONTEXT.md`.

## Global Constraints

- TDD is mandatory: failing test first, run it, then code, then run it. Paste RED and GREEN output in reports.
- CONTEXT.md terms: Achievement, Encounter, Attempt, Fact, Mastered, Quest, Loot, Character. Never "badge", "medal" as the noun in code identifiers (the CSS glyph class is fine), "trophy" for an Achievement, "user".
- No magic strings compared in production code; as-const objects (`Outcome.Critical`, `MasteryState.Mastered`, `EncounterStatus.Won`). Docstrings on every export. Comments state constraints.
- No commit trailers or attribution. Conventional subjects. Never `git push`.
- Component test files start with `// @vitest-environment jsdom` and call `afterEach(cleanup)`; fake-timer tests wrap `vi.advanceTimersByTime` in `act`.
- The twenty Achievements, their ids, names, and hints are exactly the spec's table; row names "The Zeros" through "The Twelves" in numeric row order 0 to 12, placed after `flawless-encounter` and before `skill-times-table`.
- A row Achievement is earned at 11 of 13 Facts Mastered (the same threshold `rows.ts` uses); mastery uses the warm-up streak rule (`masteryStreakFor`) and the times-table threshold.
- Survival Attempts and records count for every Achievement except `first-quest`.

---

### Task 1: Achievements derivation

**Files:**
- Create: `src/game/achievements.ts`, `src/game/achievements.test.ts`
- Modify: `src/engine/rows.ts` (export the row-complete threshold as `ROW_COMPLETE_AT`)

**Interfaces:**
- Consumes: `factStatus`, `TIMES_TABLE_THRESHOLD_MS` from `src/engine/mastery.ts`; `masteryStreakFor`, `rowFactIds`, `ROW_COMPLETE_AT` from `src/engine/rows.ts`; `timesTableFacts` from `src/engine/timesTable.ts`; `EncounterStatus` from `src/engine/combat.ts`; `MasteryState`, `Outcome`, `Attempt`, `FactId` from `src/engine/types.ts`; `QUEST_1` from `src/content/quest1.ts`; `questComplete` from `src/game/quest.ts`; `SaveData` from `src/storage/save.ts`.
- Produces: `interface Achievement { id; name; hint; earnedAt: string | null }`; `ACHIEVEMENT_COUNT` (20); `achievements(save): Achievement[]`; `newlyEarned(before, after): Achievement[]`.

- [ ] **Step 1: Export the row threshold**

In `src/engine/rows.ts`, change `const COMPLETE_AT = Math.ceil(13 * 0.8); // 11 of 13` to
```ts
/** A row completes, and its Achievement is earned, at 80% of its 13 Facts Mastered: 11. */
export const ROW_COMPLETE_AT = Math.ceil(13 * 0.8);
```
and replace the one use of `COMPLETE_AT` in `introducedRows` with `ROW_COMPLETE_AT`. Run `npx vitest run src/engine/rows.test.ts` to confirm nothing changed.

- [ ] **Step 2: Write the failing tests**

`src/game/achievements.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_COUNT, achievements, newlyEarned } from './achievements';
import { beginEncounter, cast, nextProblem } from './play';
import { survivalRoster } from './survival';
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { factId, timesTableFacts } from '../engine/timesTable';
import { Outcome, type Attempt } from '../engine/types';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

const T0 = Date.parse('2026-09-17T12:00:00.000Z');
const at = (i: number) => new Date(T0 + i * 1000).toISOString();
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const attempt = (i: number, over: Partial<Attempt> = {}): Attempt => ({
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: at(i), encounterId: 'e1', outcome: Outcome.Critical, ...over,
});
const won = (id: string, endedAt: string, monsterId = 'gob-nine', questId = QUEST_1.id): EncounterRecord => ({
  id, questId, monsterId, monsterMaxHp: 6, startedAt: endedAt, endedAt, status: EncounterStatus.Won, xp: 12, loot: null,
});
const earnedIds = (save: SaveData) => achievements(save).filter((a) => a.earnedAt !== null).map((a) => a.id);
const byId = (save: SaveData, id: string) => achievements(save).find((a) => a.id === id)!;

describe('achievements', () => {
  it('lists exactly twenty in table order with nothing earned for a new Player (invariant 1)', () => {
    const list = achievements(base());
    expect(list).toHaveLength(ACHIEVEMENT_COUNT);
    expect(ACHIEVEMENT_COUNT).toBe(20);
    expect(list.map((a) => a.id)).toEqual([
      'first-hit', 'first-critical', 'five-criticals', 'flawless-encounter',
      ...Array.from({ length: 13 }, (_, n) => `row-${n}`), 'skill-times-table', 'first-quest',
    ]);
    expect(list.every((a) => a.earnedAt === null)).toBe(true);
    expect(byId(base(), 'row-9').name).toBe('The Nines');
    expect(byId(base(), 'row-9').hint).toBe('Master the 9 times table row.');
    expect(byId(base(), 'first-quest').name).toBe('Fortress Taken');
  });

  it('first Hit and first Critical Hit take the at of the first qualifying Attempt', () => {
    const save = { ...base(), attempts: [attempt(0, { outcome: Outcome.Miss, correct: false }), attempt(1, { outcome: Outcome.Hit, durationMs: 5000 }), attempt(2)] };
    expect(byId(save, 'first-hit').earnedAt).toBe(at(1));
    expect(byId(save, 'first-critical').earnedAt).toBe(at(2));
  });

  it('five Criticals must be in one Encounter (invariant 4)', () => {
    const split = { ...base(), attempts: [0, 1, 2].map((i) => attempt(i, { encounterId: 'a' })).concat([3, 4].map((i) => attempt(i, { encounterId: 'b' }))) };
    expect(byId(split, 'five-criticals').earnedAt).toBeNull();
    const together = { ...base(), attempts: [0, 1, 2, 3, 4, 5].map((i) => attempt(i)) };
    expect(byId(together, 'five-criticals').earnedAt).toBe(at(4));
  });

  it('Flawless needs a won record whose Attempts have no Miss', () => {
    const attempts = [attempt(0, { encounterId: 'e1', outcome: Outcome.Miss, correct: false }), attempt(1, { encounterId: 'e1' }), attempt(2, { encounterId: 'e2' })];
    const save = { ...base(), attempts, encounters: [won('e1', at(1)), won('e2', at(2))] };
    expect(byId(save, 'flawless-encounter').earnedAt).toBe(at(2));
  });

  it('row-0 needs 11 Facts Mastered under the warm-up rule; the whole table needs all 91 (invariant 5)', () => {
    const rowZero = Array.from({ length: 11 }, (_, i) => attempt(i, { factId: factId(0, i) }));
    const save = { ...base(), attempts: rowZero };
    expect(byId(save, 'row-0').earnedAt).toBe(at(10));
    expect(byId({ ...base(), attempts: rowZero.slice(0, 10) }, 'row-0').earnedAt).toBeNull();
    let i = 0;
    const all: Attempt[] = [];
    for (const f of timesTableFacts()) {
      const n = f.a <= 1 || f.b <= 1 ? 1 : 3;
      for (let k = 0; k < n; k++) all.push(attempt(i++, { factId: f.id }));
    }
    const mastered = { ...base(), attempts: all };
    expect(byId(mastered, 'skill-times-table').earnedAt).toBe(at(i - 1));
    expect(byId({ ...base(), attempts: all.slice(0, -1) }, 'skill-times-table').earnedAt).toBeNull();
    for (let n = 0; n <= 12; n++) expect(byId(mastered, `row-${n}`).earnedAt).not.toBeNull();
  });

  it('Fortress Taken needs the boss won in the Quest, not in Survival', () => {
    const records = QUEST_1.encounters.map((e, i) => won(`q${i}`, at(i), e.monsterId));
    expect(byId({ ...base(), encounters: records }, 'first-quest').earnedAt).toBe(at(6));
    const survival = QUEST_1.encounters.map((e, i) => won(`s${i}`, at(i), e.monsterId, 'survival'));
    expect(byId({ ...base(), encounters: survival }, 'first-quest').earnedAt).toBeNull();
  });

  it('once earned stays earned across any prefix of history (invariant 2)', () => {
    const attempts = [attempt(0), attempt(1, { outcome: Outcome.Miss, correct: false }), attempt(2), attempt(3, { outcome: Outcome.Miss, correct: false })];
    const full = { ...base(), attempts, encounters: [won('e1', at(3))] };
    for (let k = 0; k <= attempts.length; k++) {
      const prefix = { ...base(), attempts: attempts.slice(0, k) };
      for (const a of achievements(prefix)) {
        if (a.earnedAt !== null) expect(byId(full, a.id).earnedAt).toBe(a.earnedAt);
      }
    }
  });

  it('a perfect Player earns First Hit, First Critical Hit, Flawless, then Fortress Taken in order (invariant 3)', () => {
    let save = base();
    let t = 0;
    const rng = () => 0.5;
    QUEST_1.encounters.forEach((template, i) => {
      let { save: s, encounter } = beginEncounter(save, template, new Date(T0 + t), `q${i}`);
      save = s;
      while (encounter.status === EncounterStatus.Active) {
        const p = nextProblem(save, encounter, new Date(T0 + t), rng);
        t += 1000;
        ({ save, encounter } = cast(save, encounter, template, p, p.answer, 1000, new Date(T0 + t), rng));
      }
    });
    const order = ['first-hit', 'first-critical', 'flawless-encounter', 'first-quest'].map((id) => byId(save, id).earnedAt);
    expect(order.every((d) => d !== null)).toBe(true);
    expect([...order].sort()).toEqual(order);
    expect(byId(save, 'first-hit').earnedAt).toBe(byId(save, 'first-critical').earnedAt);
  });

  it('Survival fights count for combat Achievements', () => {
    let { save, encounter } = beginEncounter(base(), survivalRoster(QUEST_1)[0]!, new Date(T0), 's1');
    const p = nextProblem(save, encounter, new Date(T0), () => 0.5);
    ({ save } = cast(save, encounter, survivalRoster(QUEST_1)[0]!, p, p.answer, 1000, new Date(T0), () => 0.5));
    expect(earnedIds(save)).toEqual(['first-hit', 'first-critical']);
  });
});

describe('newlyEarned', () => {
  it('lists exactly the ids that moved from null to a date (invariant 6)', () => {
    const before = { ...base(), attempts: [attempt(0, { outcome: Outcome.Hit, durationMs: 5000 })] };
    const after = { ...before, attempts: [...before.attempts, attempt(1)] };
    expect(newlyEarned(before, after).map((a) => a.id)).toEqual(['first-critical']);
    expect(newlyEarned(after, after)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/game/achievements.test.ts`
Expected: FAIL, cannot resolve `./achievements`.

- [ ] **Step 4: Implement**

`src/game/achievements.ts`:
```ts
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { factStatus, TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { masteryStreakFor, ROW_COMPLETE_AT, rowFactIds } from '../engine/rows';
import { timesTableFacts } from '../engine/timesTable';
import { MasteryState, Outcome, type Attempt, type FactId } from '../engine/types';
import type { SaveData } from '../storage/save';
import { questComplete } from './quest';

/** One trophy-case entry: earned when `earnedAt` is set. */
export interface Achievement {
  id: string;
  name: string;
  hint: string;
  earnedAt: string | null;
}

interface Definition {
  id: string;
  name: string;
  hint: string;
}

const Id = {
  FirstHit: 'first-hit', FirstCritical: 'first-critical', FiveCriticals: 'five-criticals', Flawless: 'flawless-encounter',
  Skill: 'skill-times-table', FirstQuest: 'first-quest',
} as const;
const rowId = (n: number) => `row-${n}`;
const ROW_NAMES = ['The Zeros', 'The Ones', 'The Twos', 'The Threes', 'The Fours', 'The Fives', 'The Sixes', 'The Sevens', 'The Eights', 'The Nines', 'The Tens', 'The Elevens', 'The Twelves'];
const FIVE = 5;
const TABLE_SIZE = timesTableFacts().length;

const DEFINITIONS: Definition[] = [
  { id: Id.FirstHit, name: 'First Hit', hint: 'Land a Hit.' },
  { id: Id.FirstCritical, name: 'First Critical Hit', hint: 'Answer fast enough for a Critical Hit.' },
  { id: Id.FiveCriticals, name: 'Five Criticals', hint: 'Land five Critical Hits in one Encounter.' },
  { id: Id.Flawless, name: 'Flawless', hint: 'Win an Encounter without a Miss.' },
  ...ROW_NAMES.map((name, n) => ({ id: rowId(n), name, hint: `Master the ${n} times table row.` })),
  { id: Id.Skill, name: 'Times Table Master', hint: 'Master every Fact in the multiplication table.' },
  { id: Id.FirstQuest, name: 'Fortress Taken', hint: 'Finish the Fortress of Twelves.' },
];

/** How many Achievements exist; the Trophy Case shows this as the denominator. */
export const ACHIEVEMENT_COUNT = DEFINITIONS.length;

/**
 * Every Achievement with the moment it was first earned, derived in one pass over the save.
 * Attempts and records are append-only and in order, so the first satisfying event is the earliest.
 * Nothing is stored; once earned an Achievement cannot be lost, even if the mastery behind it is.
 */
export function achievements(save: SaveData): Achievement[] {
  const earned = new Map<string, string>();
  const first = (id: string, atTime: string) => { if (!earned.has(id)) earned.set(id, atTime); };
  const byFact: Record<FactId, Attempt[]> = {};
  const mastered = new Set<FactId>();
  const criticals: Record<string, number> = {};
  const missed = new Set<string>();
  const rowsDone = new Set<number>();

  for (const a of save.attempts) {
    if (a.outcome === Outcome.Miss) missed.add(a.encounterId);
    if (a.outcome === Outcome.Hit || a.outcome === Outcome.Critical) first(Id.FirstHit, a.at);
    if (a.outcome === Outcome.Critical) {
      first(Id.FirstCritical, a.at);
      criticals[a.encounterId] = (criticals[a.encounterId] ?? 0) + 1;
      if (criticals[a.encounterId] === FIVE) first(Id.FiveCriticals, a.at);
    }
    (byFact[a.factId] ??= []).push(a);
    const status = factStatus(byFact[a.factId]!, TIMES_TABLE_THRESHOLD_MS, masteryStreakFor(a.factId));
    if (status.state === MasteryState.Mastered) mastered.add(a.factId);
    else mastered.delete(a.factId);
    for (let n = 0; n < ROW_NAMES.length; n++) {
      if (!rowsDone.has(n) && rowFactIds(n).filter((id) => mastered.has(id)).length >= ROW_COMPLETE_AT) {
        rowsDone.add(n);
        first(rowId(n), a.at);
      }
    }
    if (mastered.size === TABLE_SIZE) first(Id.Skill, a.at);
  }

  for (const r of save.encounters) {
    if (r.status === EncounterStatus.Won && !missed.has(r.id)) first(Id.Flawless, r.endedAt);
  }
  if (questComplete(save, QUEST_1)) {
    const boss = QUEST_1.encounters[QUEST_1.encounters.length - 1]!;
    const win = save.encounters.find((r) => r.questId === QUEST_1.id && r.monsterId === boss.monsterId && r.status === EncounterStatus.Won);
    if (win) first(Id.FirstQuest, win.endedAt);
  }

  return DEFINITIONS.map((d) => ({ ...d, earnedAt: earned.get(d.id) ?? null }));
}

/** The Achievements earned between two saves: unearned before, earned after. */
export function newlyEarned(before: SaveData, after: SaveData): Achievement[] {
  const was = new Set(achievements(before).filter((a) => a.earnedAt !== null).map((a) => a.id));
  return achievements(after).filter((a) => a.earnedAt !== null && !was.has(a.id));
}
```

- [ ] **Step 5: Run the file, the suite, and typecheck**

Run: `npx vitest run src/game/achievements.test.ts && npm test && npm run typecheck`
Expected: 10 tests pass in the file; suite green; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/game/achievements.ts src/game/achievements.test.ts src/engine/rows.ts
git commit -m "feat: Achievements derived from Attempts and Encounter records"
```

---

### Task 2: Trophy Case screen and the reveals

**Files:**
- Rename: `src/ui/LootScreen.tsx` → `src/ui/TrophyCaseScreen.tsx`; `src/ui/LootScreen.test.tsx` → `src/ui/TrophyCaseScreen.test.tsx` (`git mv`)
- Modify: `src/ui/ResultScreen.tsx`, `src/ui/ResultScreen.test.tsx`, `src/ui/SurvivalResultScreen.tsx`, `src/ui/SurvivalResultScreen.test.tsx`, `src/ui/TitleScreen.tsx`, `src/ui/styles.css`

**Interfaces:**
- Consumes: `achievements`, `ACHIEVEMENT_COUNT`, `Achievement` from `src/game/achievements.ts`; everything the Loot screen already used.
- Produces: `TrophyCaseScreen({ save, onTitle })`; `ResultScreen` and `SurvivalResultScreen` prop `earned?: Achievement[]`; `TitleScreen` prop `onTrophies` with a "Trophy Case" button (temporarily optional, rendered when given; Task 3 wires it and removes `onLoot`).

- [ ] **Step 1: Rename and write the failing tests**

```bash
git mv src/ui/LootScreen.tsx src/ui/TrophyCaseScreen.tsx
git mv src/ui/LootScreen.test.tsx src/ui/TrophyCaseScreen.test.tsx
```

In `src/ui/TrophyCaseScreen.test.tsx`: change the import to `import { TrophyCaseScreen } from './TrophyCaseScreen';`, every `<LootScreen` to `<TrophyCaseScreen`, and `describe('LootScreen'` to `describe('TrophyCaseScreen'`. In the first Loot test change `expect(screen.getByRole('heading').textContent).toBe('Loot');` to `expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trophy Case');`. Add to the same describe, importing `Outcome` from `../engine/types` and `type Attempt`:
```tsx
  it('lists twenty Achievements in order, greyed with hints until earned, and dates the earned ones (invariant 7)', () => {
    const hit: Attempt = { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-17T12:00:00.000Z', encounterId: 'e1', outcome: Outcome.Critical };
    render(<TrophyCaseScreen save={{ ...base(), attempts: [hit] }} onTitle={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Achievements' })).toBeTruthy();
    expect(screen.getByText('2 of 20')).toBeTruthy();
    const rows = screen.getAllByRole('listitem').filter((li) => li.classList.contains('achievement'));
    expect(rows).toHaveLength(20);
    expect(rows[0]!.textContent).toContain('First Hit');
    expect(rows[0]!.textContent).toContain('Land a Hit.');
    expect(rows[0]!.classList.contains('earned')).toBe(true);
    expect(rows[0]!.textContent).toContain(new Date('2026-09-17T12:00:00.000Z').toLocaleDateString());
    expect(rows[2]!.textContent).toContain('Five Criticals');
    expect(rows[2]!.classList.contains('earned')).toBe(false);
    expect(rows[19]!.textContent).toContain('Fortress Taken');
  });
```

Add to `src/ui/ResultScreen.test.tsx` inside `describe('ResultScreen')`:
```tsx
  it('lists newly earned Achievements under the Loot reveal', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    const earned = [{ id: 'first-hit', name: 'First Hit', hint: 'Land a Hit.', earnedAt: NOW.toISOString() }];
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} earned={earned} />);
    expect(screen.getByText('Achievement: First Hit')).toBeTruthy();
  });
```

Create `src/ui/SurvivalResultScreen.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SurvivalResultScreen } from './SurvivalResultScreen';

afterEach(cleanup);

describe('SurvivalResultScreen', () => {
  it('lists newly earned Achievements under the XP line', () => {
    const earned = [{ id: 'five-criticals', name: 'Five Criticals', hint: 'Land five Critical Hits in one Encounter.', earnedAt: '2026-09-17T12:00:00.000Z' }];
    render(<SurvivalResultScreen wins={2} xpGained={26} best={2} newBest onAgain={() => {}} onTitle={() => {}} earned={earned} />);
    expect(screen.getByText('Achievement: Five Criticals')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Run again' }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/TrophyCaseScreen.test.tsx src/ui/ResultScreen.test.tsx src/ui/SurvivalResultScreen.test.tsx`
Expected: FAIL, `TrophyCaseScreen` not exported; "Achievement:" texts missing.

- [ ] **Step 3: Implement**

`src/ui/TrophyCaseScreen.tsx` (whole file):
```tsx
import { LOOT } from '../content/quest1';
import { ACHIEVEMENT_COUNT, achievements } from '../game/achievements';
import { ownedLoot } from '../game/loot';
import type { SaveData } from '../storage/save';
import { LootArt } from './LootArt';

/** Everything the Character has earned: the Loot grid and the Achievement list, both derived from the save. */
export function TrophyCaseScreen({ save, onTitle }: { save: SaveData; onTitle: () => void }) {
  const owned = ownedLoot(save);
  const ids = Object.keys(LOOT);
  // Count is pool-scoped: a won record can carry a retired id no longer in LOOT, which must not inflate the total.
  const ownedHere = ids.filter((id) => owned.has(id));
  const list = achievements(save);
  const earnedCount = list.filter((a) => a.earnedAt !== null).length;
  return (
    <main className="screen loot-screen">
      <h1>Trophy Case</h1>
      <h2>Loot</h2>
      <p>{ownedHere.length} of {ids.length}</p>
      <ul className="loot-grid">
        {ids.map((id) => (
          <li key={id} className={owned.has(id) ? 'loot-slot' : 'loot-slot unowned'}>
            <LootArt id={id} />
            {owned.has(id) ? <span className="loot-name">{LOOT[id]}</span> : <span className="loot-mark">?</span>}
          </li>
        ))}
      </ul>
      <h2>Achievements</h2>
      <p>{earnedCount} of {ACHIEVEMENT_COUNT}</p>
      <ul className="achievements">
        {list.map((a) => (
          <li key={a.id} className={a.earnedAt ? 'achievement earned' : 'achievement'}>
            <span className="medal-glyph" aria-hidden="true" />
            <span className="achievement-text">
              <span className="achievement-name">{a.name}</span>
              <span className="achievement-hint">{a.hint}</span>
              {a.earnedAt && <span className="achievement-date">{new Date(a.earnedAt).toLocaleDateString()}</span>}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="primary" onClick={onTitle} autoFocus>Title</button>
    </main>
  );
}
```

`src/ui/ResultScreen.tsx`: import `type Achievement` from `../game/achievements`; add `earned?: Achievement[];` to the props and destructure `earned = []`; render after the Loot reveal block:
```tsx
      {earned.map((a) => <p key={a.id} className="achievement-line" role="status">Achievement: {a.name}</p>)}
```
Note: keep `Achievement: {a.name}` as one text node pair in the same element so `getByText('Achievement: First Hit')` matches.

`src/ui/SurvivalResultScreen.tsx`: same prop; render the same lines after the `+{xpGained} XP` line.

`src/ui/TitleScreen.tsx`: add `onTrophies?: () => void;` and render `{onTrophies && <button type="button" onClick={onTrophies}>Trophy Case</button>}` in place of the Loot button when given; keep `onLoot` for now so Task 3 can swap cleanly.

Append to `src/ui/styles.css`:
```css
.loot-screen h2 { font-size: 1.4rem; margin: 8px 0 0; }
.achievements { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; width: 100%; max-width: 720px; }
.achievement { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 3px solid var(--frame); border-radius: 12px; background: #fff; opacity: 0.55; }
.achievement.earned { opacity: 1; }
.medal-glyph { flex: none; width: 40px; height: 40px; border-radius: 50%; border: 3px solid var(--frame); background: #fff; }
.achievement.earned .medal-glyph { background: #f2c94c; box-shadow: inset 0 0 0 6px #fff3c4; }
.achievement-text { display: flex; flex-direction: column; }
.achievement-name { font-weight: 700; }
.achievement-hint, .achievement-date { font-size: 0.95rem; }
.achievement-line { font-weight: 700; color: var(--hit); }
```

- [ ] **Step 4: Run the files, the suite, and typecheck**

Run: `npx vitest run src/ui/TrophyCaseScreen.test.tsx src/ui/ResultScreen.test.tsx src/ui/SurvivalResultScreen.test.tsx && npm test && npm run typecheck`
Expected: 5, 4, and 1 tests pass in the three files; `App.test.tsx` still passes (it imports `LootScreen` nowhere; it clicks the "Loot" button, still present until Task 3); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A src/ui
git commit -m "feat: Trophy Case with Achievements; result screens list newly earned Achievements"
```

---

### Task 3: App wiring

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/ui/TitleScreen.tsx` (drop `onLoot`, make `onTrophies` required)

**Interfaces:**
- Consumes: `newlyEarned`, `Achievement` from `src/game/achievements.ts`; `TrophyCaseScreen`; the `earned` props.
- Produces: `Screen.Trophies` replaces `Screen.Loot`; `saveBefore` kept at Encounter and run start; both result screens receive `earned`.

- [ ] **Step 1: Write the failing tests**

In `src/App.test.tsx`: in the two existing Loot tests, change `{ name: 'Loot' }` to `{ name: 'Trophy Case' }` and `getByRole('heading', { name: 'Loot' })` to `getByRole('heading', { name: 'Trophy Case' })`. Add:
```tsx
  it('the first won fight reveals First Hit, First Critical Hit, and Flawless as Achievements', async () => {
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
      expect(screen.getByText('Achievement: First Hit')).toBeTruthy();
      expect(screen.getByText('Achievement: First Critical Hit')).toBeTruthy();
      expect(screen.getByText('Achievement: Flawless')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Title' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Trophy Case' }));
      expect(screen.getByText('3 of 20')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL, no "Trophy Case" button; no Achievement lines.

- [ ] **Step 3: Implement**

`src/ui/TitleScreen.tsx`: remove `onLoot` and the Loot button; `onTrophies: () => void` required; the button `<button type="button" onClick={onTrophies}>Trophy Case</button>` stays between Play/Continue and Survival.

`src/App.tsx`:
- Imports: replace the `LootScreen` import with `import { TrophyCaseScreen } from './ui/TrophyCaseScreen';`; add `import { newlyEarned, type Achievement } from './game/achievements';`.
- `Screen`: rename `Loot: 'loot'` to `Trophies: 'trophies'`.
- State: `const [saveBefore, setSaveBefore] = useState<SaveData | null>(null);` and `const [earned, setEarned] = useState<Achievement[]>([]);`.
- Wherever `setXpBefore(...)` is called (`play` resume branch, `fight`, `survive`), also call `setSaveBefore(<the same data>)`.
- Encounter `onFinish`: add `setEarned(saveBefore ? newlyEarned(saveBefore, data) : []);` before `setScreen(Screen.Result)`.
- Survival `onEnd`: add `setEarned(saveBefore ? newlyEarned(saveBefore, data) : []);` before `setScreen(Screen.SurvivalResult)`.
- `ResultScreen` and `SurvivalResultScreen` get `earned={earned}`.
- Case `Screen.Trophies`: `<TrophyCaseScreen save={save} onTitle={() => setScreen(Screen.Title)} />`; `TitleScreen` gets `onTrophies={() => setScreen(Screen.Trophies)}` instead of `onLoot`.
- Update the App docstring to "coordinating normal, Survival, and Trophy Case screens".

- [ ] **Step 4: Run the file, the suite, typecheck, and the build**

Run: `npx vitest run src/App.test.tsx && npm test && npm run typecheck && npm run build`
Expected: all pass; suite green; typecheck clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/ui/TitleScreen.tsx
git commit -m "feat: Trophy Case on the title; newly earned Achievements shown after every fight"
```

---

## Out of scope for this plan (next plans)

1. **Guide screen**: Export, Reset, Learning Plan import.
2. **Achievements for later Skills** and per-Achievement icons.
3. **Art weight pass** before Quest 2.
