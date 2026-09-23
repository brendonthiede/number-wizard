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
    expect(region(/The Fortress of Twelves/).textContent).toBe('The Fortress of Twelves 0 of 7');
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
