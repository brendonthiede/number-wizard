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

  it('counts only ids in the pool, ignoring a won record for retired Loot', () => {
    const save = { ...base(), encounters: [won('a', 'retired-thing'), won('b', 'star-hat')] };
    render(<LootScreen save={save} onTitle={() => {}} />);
    expect(screen.getByText('1 of 8')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });
});
