// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TrophyCaseScreen } from './TrophyCaseScreen';
import { LootArt } from './LootArt';
import { LOOT, QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { Outcome, type Attempt } from '../engine/types';
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
    expect(img.getAttribute('src')).toContain('art/loot/star-hat.webp');
    fireEvent.error(img);
    expect(container.querySelector('img.loot')).toBeNull();
  });
});

describe('TrophyCaseScreen', () => {
  it('shows sixteen slots, names only the owned ones, counts them, and focuses Title (invariant 4)', () => {
    const onTitle = vi.fn();
    const save = { ...base(), encounters: [won('a', 'star-hat'), won('b', 'ink-staff'), won('c', 'star-hat')] };
    render(<TrophyCaseScreen save={save} onTitle={onTitle} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trophy Case');
    expect(screen.getByText('2 of 16')).toBeTruthy();
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('loot-slot'))).toHaveLength(16);
    expect(screen.getByText('Star Hat')).toBeTruthy();
    expect(screen.getByText('Ink Staff')).toBeTruthy();
    expect(screen.queryByText('Moon Hat')).toBeNull();
    expect(screen.getAllByText('?')).toHaveLength(14);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Title' }));
    expect(window.scrollY).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalled();
  });

  it('shows every name once all sixteen are owned', () => {
    const save = { ...base(), encounters: Object.keys(LOOT).map((id, i) => won(`w${i}`, id)) };
    render(<TrophyCaseScreen save={save} onTitle={() => {}} />);
    expect(screen.getByText('16 of 16')).toBeTruthy();
    for (const name of Object.values(LOOT)) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.queryByText('?')).toBeNull();
  });

  it('counts only ids in the pool, ignoring a won record for retired Loot', () => {
    const save = { ...base(), encounters: [won('a', 'retired-thing'), won('b', 'star-hat')] };
    render(<TrophyCaseScreen save={save} onTitle={() => {}} />);
    expect(screen.getByText('1 of 16')).toBeTruthy();
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('loot-slot'))).toHaveLength(16);
  });

  it('formats the earned day in en-US even on a device set to another locale', () => {
    const hit: Attempt = { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-17T12:00:00.000Z', encounterId: 'e1', outcome: Outcome.Critical };
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString');
    render(<TrophyCaseScreen save={{ ...base(), attempts: [hit] }} onTitle={() => {}} />);
    expect(spy).toHaveBeenCalledWith('en-US', { month: 'short', day: 'numeric' });
    spy.mockRestore();
  });

  it('lists twenty-five Achievements in order, greyed with hints until earned, and dates the earned ones (invariant 7)', () => {
    const hit: Attempt = { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-17T12:00:00.000Z', encounterId: 'e1', outcome: Outcome.Critical };
    render(<TrophyCaseScreen save={{ ...base(), attempts: [hit] }} onTitle={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Achievements' })).toBeTruthy();
    expect(screen.getByText('2 of 25')).toBeTruthy();
    const rows = screen.getAllByRole('listitem').filter((li) => li.classList.contains('achievement'));
    expect(rows).toHaveLength(25);
    expect(rows[0]!.textContent).toContain('First Hit');
    expect(rows[0]!.classList.contains('earned')).toBe(true);
    // A literal, not a mirrored call: the format is fixed whatever the device locale, and noon UTC is Sep 17 everywhere.
    expect(rows[0]!.textContent).toContain('Sep 17');
    expect(rows[2]!.textContent).toContain('Five Criticals');
    expect(rows[2]!.textContent).toContain('Land five Critical Hits in one Encounter.');
    expect(rows[2]!.classList.contains('earned')).toBe(false);
    expect(rows[18]!.textContent).toContain('Fortress Taken');
  });
  it('keeps Title in the screen navigation, apart from the Loot and Achievement lists (pinned navigation)', () => {
    render(<TrophyCaseScreen save={base()} onTitle={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    expect(nav.contains(screen.getByRole('button', { name: 'Title' }))).toBe(true);
    expect(nav.querySelector('.loot-grid')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Title' }));
  });
});
