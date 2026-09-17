// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SurvivalScreen } from './SurvivalScreen';
import { FEEDBACK_MS } from './EncounterScreen';
import { QUEST_1 } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import { SURVIVAL_MS } from '../game/survival';
import { emptySave, withCharacter, type SaveData } from '../storage/save';

const T0 = Date.parse('2026-09-16T12:00:00.000Z');
let seed = 5;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const now = () => new Date(); // fake timers drive Date, so the clock follows advanceTimersByTime

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); seed = 5; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function mount() {
  const onEnd = vi.fn();
  const saves: SaveData[] = [];
  const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
  render(<SurvivalScreen save={base} roster={QUEST_1.encounters} onSave={(s) => saves.push(s)} onEnd={onEnd} now={now} rng={rng} />);
  return { onEnd, saves };
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const currentAnswer = () => {
  const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
  return a! * b!;
};
const typeAndCast = (answer: number) => {
  for (const d of String(answer)) fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
};
const winOne = () => {
  for (let i = 0; i < 3; i++) {
    typeAndCast(currentAnswer());
    advance(FEEDBACK_MS.hit);
  }
};

describe('SurvivalScreen', () => {
  it('starts an Encounter with the clock at 5:00 and counts it down', () => {
    mount();
    expect(screen.getByRole('timer').textContent).toBe('5:00');
    expect(screen.getByLabelText('Answer')).toBeTruthy();
    advance(1000);
    expect(screen.getByRole('timer').textContent).toBe('4:59');
    advance(60_000);
    expect(screen.getByRole('timer').textContent).toBe('3:59');
  });

  it('persists every cast so a reload mid-run still keeps the fight', () => {
    const { saves } = mount();
    typeAndCast(currentAnswer());
    expect(saves).toHaveLength(1);
    expect(saves[0]!.attempts).toHaveLength(1);
    expect(saves[0]!.activeEncounter?.spells).toHaveLength(1);
  });

  it('flashes the win, then starts the next fight with a healed monster', () => {
    const { saves } = mount();
    winOne();
    expect(screen.getByRole('status').textContent).toBe('Victory! +12 XP');
    expect(screen.queryByLabelText('Answer')).toBeNull();
    advance(FEEDBACK_MS.hit);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('The Fourmidable Knight')).toBeTruthy();
    expect(screen.getByLabelText('7 of 7 monster hit points')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Answer'));
    const latest = saves[saves.length - 1]!;
    expect(latest.encounters).toHaveLength(1);
    expect(latest.activeEncounter?.spec.id).not.toBe(latest.encounters[0]!.id);
  });

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

  it('ends the run at the buzzer: the open fight becomes a Retreat, wins and best are reported', () => {
    const { onEnd, saves } = mount();
    winOne();
    advance(FEEDBACK_MS.hit);
    typeAndCast(currentAnswer()); // one Critical into the second fight
    advance(FEEDBACK_MS.hit);
    advance(SURVIVAL_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
    const [save, run, newBest] = onEnd.mock.calls[0]!;
    expect(run.wins).toBe(1);
    expect(newBest).toBe(true);
    expect(save.character.survivalBest).toBe(1);
    expect(save.activeEncounter).toBeNull();
    expect(save.encounters).toHaveLength(2);
    expect(save.encounters[1]).toMatchObject({ status: EncounterStatus.Retreated, xp: 2 });
    expect(saves[saves.length - 1]).toEqual(save);
  });

  it('a buzzer during the winning cast\'s banner still counts the win and records the fight once', () => {
    const { onEnd, saves } = mount();
    advance(SURVIVAL_MS - 3 * FEEDBACK_MS.hit - 500); // the first cast is slow (a Hit), then three Criticals
    for (let i = 0; i < 3; i++) {
      typeAndCast(currentAnswer());
      advance(FEEDBACK_MS.hit);
    }
    typeAndCast(currentAnswer()); // 1 + 2 + 2 + 2 damage wins; half a second left, the banner outlives the run
    advance(500);
    expect(onEnd).toHaveBeenCalledTimes(1);
    const [save, run] = onEnd.mock.calls[0]!;
    expect(run.wins).toBe(1);
    expect(save.encounters).toHaveLength(1);
    expect(save.encounters[0]).toMatchObject({ status: EncounterStatus.Won, xp: 12 });
    expect(save.character.xp).toBe(12);
    expect(save.character.survivalBest).toBe(1);
    expect(saves[saves.length - 1]).toEqual(save);
  });

  it('discards a fight with no Spell cast when the buzzer goes', () => {
    const { onEnd } = mount();
    advance(SURVIVAL_MS);
    const [save, run] = onEnd.mock.calls[0]!;
    expect(run.wins).toBe(0);
    expect(save.encounters).toHaveLength(0);
    expect(save.attempts).toHaveLength(0);
    expect(save.activeEncounter).toBeNull();
  });
});
