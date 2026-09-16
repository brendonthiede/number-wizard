// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App, APP_TITLE } from './App';
import { beginEncounter } from './game/play';
import { QUEST_1_FIRST } from './content';
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
    expect((await store.load())?.character).toEqual({ name: 'Noah', portrait: 'character-02', xp: 0 });
  });

  it('shows the title with Play for an existing Character, and Play opens an Encounter', async () => {
    const store = memoryStore();
    await store.save(named());
    render(<App store={store} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    expect(await screen.findByLabelText('Answer')).toBeTruthy();
    expect((await store.load())?.activeEncounter).not.toBeNull();
  });

  it('resumes an active Encounter on load instead of showing the title (invariant 6)', async () => {
    const store = memoryStore();
    await store.save(beginEncounter(named(), QUEST_1_FIRST, new Date(), 'e1').save);
    render(<App store={store} />);
    expect(await screen.findByLabelText('Answer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('shows a plain message and persists nothing when the save cannot be read', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { load: () => Promise.reject(new Error('Corrupt save data (version 3)')), save: vi.fn(async () => {}) };
    render(<App store={store} />);
    expect(await screen.findByText('The save could not be read.')).toBeTruthy();
    expect(store.save).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
