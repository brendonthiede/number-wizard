// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QuestScreen } from './QuestScreen';
import { PLAN_KIND } from '../game/learningPlan';
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, withLearningPlan, type EncounterRecord, type SaveData } from '../storage/save';

afterEach(cleanup);

const NOW = '2026-09-16T12:00:00.000Z';
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const won = (monsterId: string): EncounterRecord => ({
  id: monsterId, questId: QUEST_1.id, monsterId, monsterMaxHp: 6, startedAt: NOW, endedAt: NOW, status: EncounterStatus.Won, xp: 12, loot: null,
});
const row = (name: RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('QuestScreen', () => {
  it('lists seven Encounters, focuses the first open one, and disables locked ones', () => {
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={() => {}} onMap={() => {}} />);
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
    render(<QuestScreen save={{ ...base(), encounters: [won('gob-nine')] }} quest={QUEST_1} onPick={onPick} onTitle={() => {}} onFreeRoam={() => {}} onMap={() => {}} />);
    expect(row(/Gob-nine/).textContent).toContain('Won');
    expect(row(/Gob-nine/).disabled).toBe(false);
    expect(document.activeElement).toBe(row(/Fourmidable Knight/));
    fireEvent.click(row(/Gob-nine/));
    expect(onPick).toHaveBeenCalledWith(0);
    fireEvent.click(row(/Fourmidable Knight/));
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("shows each monster's max HP as pips and offers Title", () => {
    const onTitle = vi.fn();
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={onTitle} onFreeRoam={() => {}} onMap={() => {}} />);
    expect(screen.getByLabelText('15 of 15 monster hit points')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalled();
  });

  it('shows monster HP as the Learning Plan scales it', () => {
    const save = withLearningPlan(base(), { kind: PLAN_KIND, version: 1, monsterHpScale: 2 }, new Date());
    render(<QuestScreen save={save} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={() => {}} onMap={() => {}} />);
    expect(screen.getByLabelText('30 of 30 monster hit points')).toBeTruthy();
  });
  it('keeps Title in the screen navigation, apart from the Encounter list (pinned navigation)', () => {
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={() => {}} onMap={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    expect(nav.contains(screen.getByRole('button', { name: 'Title' }))).toBe(true);
    expect(nav.contains(screen.getByRole('button', { name: /Gob-nine/ }))).toBe(false);
  });

  it('offers Free Roam in the screen navigation only once the Quest is complete', () => {
    const onFreeRoam = vi.fn();
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={onFreeRoam} onMap={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Free Roam' })).toBeNull();
    cleanup();
    const done = { ...base(), encounters: QUEST_1.encounters.map((e) => won(e.monsterId)) };
    render(<QuestScreen save={done} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={onFreeRoam} onMap={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    const free = screen.getByRole('button', { name: 'Free Roam' });
    expect(nav.contains(free)).toBe(true);
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Map', 'Title', 'Free Roam']);
    fireEvent.click(free);
    expect(onFreeRoam).toHaveBeenCalledTimes(1);
  });
  it('offers a way back to the Map in the screen navigation', () => {
    const onMap = vi.fn();
    render(<QuestScreen save={base()} quest={QUEST_1} onPick={() => {}} onTitle={() => {}} onFreeRoam={() => {}} onMap={onMap} />);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    const map = screen.getByRole('button', { name: 'Map' });
    expect(nav.contains(map)).toBe(true);
    fireEvent.click(map);
    expect(onMap).toHaveBeenCalledTimes(1);
  });
});
