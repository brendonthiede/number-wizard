// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { beginEncounter, cast, nextProblem } from './game/play';
import { APP_TITLE, QUEST_1_FIRST } from './content';
import { QUEST_1 } from './content/quest1';
import { SURVIVAL_MS } from './game/survival';
import { emptySave, memoryStore, withCharacter } from './storage/save';

afterEach(cleanup);

const named = () => withCharacter(emptySave('noah'), 'Noah', 'character-01');

describe('App', () => {
  it('has the game title', () => {
    expect(APP_TITLE).toBe('Number Wizard');
  });

  it('shows Character creation when the save has no name, then the title after Begin', async () => {
    const store = memoryStore();
    render(<App store={store} />);
    expect(await screen.findByText('Who are you?')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Noah' } });
    fireEvent.click(screen.getByRole('radio', { name: 'character-02' }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy();
    expect((await store.load())?.character).toEqual({ name: 'Noah', portrait: 'character-02', xp: 0, survivalBest: 0 });
  });

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

  it('resumes at the title with Continue, not straight into the fight; Continue carries the saved monster HP (F2)', async () => {
    const store = memoryStore();
    const begun = beginEncounter(named(), QUEST_1_FIRST, new Date(), 'e1');
    const wounded = { ...begun.encounter, monsterHp: 4 };
    await store.save({ ...begun.save, activeEncounter: wounded });
    render(<App store={store} />);
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByLabelText('4 of 6 monster hit points')).toBeTruthy();
    expect((await store.load())?.activeEncounter?.spec.id).toBe('e1');
  });

  it('shows a plain message and persists nothing when the save cannot be read', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { load: () => Promise.reject(new Error('Corrupt save data (version 3)')), save: vi.fn(async () => {}) };
    render(<App store={store} />);
    expect(await screen.findByText('The save could not be read.')).toBeTruthy();
    expect(store.save).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows a quiet notice on the title when a write fails, without interrupting play (F5)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { load: () => Promise.resolve(undefined), save: () => Promise.reject(new Error('write failed')) };
    render(<App store={store} />);
    expect(await screen.findByText('Who are you?')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Noah' } });
    fireEvent.click(screen.getByRole('radio', { name: 'character-02' }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(await screen.findByText('Progress is not being saved. Ask your Guide for help.')).toBeTruthy();
    spy.mockRestore();
  });

  describe('Survival', () => {
  it('starts a timed run from the title and ends on the Survival result with Run again focused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(Date.parse('2026-09-16T12:00:00.000Z'));
    try {
      const store = memoryStore();
      await store.save(named());
      render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Survival' }));
      expect(screen.getByRole('timer').textContent).toBe('5:00');
      expect(screen.getByLabelText('Answer')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(SURVIVAL_MS); });
      expect(screen.getByRole('heading').textContent).toBe("Time's up!");
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Run again' }));
      fireEvent.click(screen.getByRole('button', { name: 'Run again' }));
      expect(screen.getByRole('timer').textContent).toBe('5:00');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Survival from an open Encounter', () => {
  it('forfeits the open fight as a Retreat so no Attempt is orphaned', async () => {
    const store = memoryStore();
    let { save, encounter } = beginEncounter(named(), QUEST_1_FIRST, new Date(), 'open');
    const p = nextProblem(save, encounter, new Date(), () => 0.5);
    ({ save } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, new Date(), () => 0.5));
    await store.save(save);
    render(<App store={store} now={() => new Date()} rng={() => 0.5} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Survival' }));
    expect(screen.getByRole('timer')).toBeTruthy();
    const stored = (await store.load())!;
    expect(stored.encounters).toHaveLength(1);
    expect(stored.encounters[0]).toMatchObject({ id: 'open', status: 'retreated', xp: 2 });
    expect(stored.activeEncounter?.spec.id).not.toBe('open');
  });
});

describe('Retreat (F3)', () => {
    const T0 = Date.parse('2026-09-16T12:00:00.000Z');
    let seed = 3;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

    afterEach(() => { vi.useRealTimers(); });

    it('five Misses in a row ends in a Retreat, recorded with +0 XP', async () => {
      seed = 3;
      let t = T0;
      const now = () => new Date(t);
      const store = memoryStore();
      await store.save(named());
      render(<App store={store} now={now} rng={rng} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
      fireEvent.click(await screen.findByRole('button', { name: /Gob-nine/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
      screen.getByLabelText('Answer');

      vi.useFakeTimers();
      for (let i = 0; i < 5; i++) {
        const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
        const wrong = a! * b! + 1;
        for (const d of String(wrong)) fireEvent.click(screen.getByRole('button', { name: d }));
        fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
        t += 3000;
        act(() => { vi.advanceTimersByTime(3000); });
      }

      expect(screen.getByText('You retreat to fight another day.')).toBeTruthy();
      expect(screen.getByText('+0 XP')).toBeTruthy();
      const data = await store.load();
      expect(data?.encounters).toHaveLength(1);
      expect(data?.encounters[0]).toMatchObject({ status: 'retreated' });
      expect(data?.activeEncounter).toBeNull();
      expect(data?.character.xp).toBe(0);
    });
  });
});
