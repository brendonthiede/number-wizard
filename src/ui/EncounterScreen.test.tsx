// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EncounterScreen, FEEDBACK_MS } from './EncounterScreen';
import { beginEncounter } from '../game/play';
import { QUEST_1_FIRST } from '../content';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter } from '../storage/save';

const T0 = Date.parse('2026-09-16T12:00:00.000Z');
let t = T0;
const now = () => new Date(t);
let seed = 3;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

beforeEach(() => { vi.useFakeTimers(); t = T0; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function mount(onFinish = vi.fn(), onSave = vi.fn()) {
  const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
  const { save, encounter } = beginEncounter(base, QUEST_1_FIRST, now(), 'e1');
  render(<EncounterScreen save={save} encounter={encounter} template={QUEST_1_FIRST} onSave={onSave} onFinish={onFinish} now={now} rng={rng} />);
  return { onFinish, onSave };
}

const input = () => screen.getByLabelText('Answer') as HTMLInputElement;
const currentAnswer = () => {
  const [a, b] = screen.getByText(/=$/).textContent!.match(/\d+/g)!.map(Number);
  return a! * b!;
};
const typeAndCast = (answer: number) => {
  for (const d of String(answer)) fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
};
const clearFeedback = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('EncounterScreen', () => {
  it('focuses the answer input on mount (invariant 7)', () => {
    mount();
    expect(document.activeElement).toBe(input());
  });

  it('shows both fighters at full HP with the monster name', () => {
    mount();
    expect(screen.getByLabelText('5 of 5 hearts')).toBeTruthy();
    expect(screen.getByLabelText('6 of 6 monster hit points')).toBeTruthy();
    expect(screen.getByText('Gob-nine')).toBeTruthy();
  });

  it('uses the template background for the panel, not a hardcoded one (F4)', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    const template = { ...QUEST_1_FIRST, background: 'crypt-01' };
    const { save, encounter } = beginEncounter(base, template, now(), 'e1');
    render(<EncounterScreen save={save} encounter={encounter} template={template} onSave={vi.fn()} onFinish={vi.fn()} now={now} rng={rng} />);
    const panel = document.querySelector('.panel') as HTMLElement;
    expect(panel.style.backgroundImage).toContain('crypt-01');
  });

  it('a fast correct cast is a Critical Hit: pips drop, feedback shows, input locked, then the next Problem is focused', () => {
    const { onSave } = mount();
    const first = screen.getByText(/=$/).textContent;
    typeAndCast(currentAnswer());
    expect(screen.getByRole('status').textContent).toBe('Critical Hit!');
    expect(screen.getByLabelText('4 of 6 monster hit points')).toBeTruthy();
    expect(input().disabled).toBe(true); // invariant 5
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    clearFeedback(FEEDBACK_MS.hit);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/=$/).textContent).not.toBe(first);
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
  });

  it('a slow correct cast is a Hit for 1', () => {
    mount();
    const answer = currentAnswer();
    t += 4500;
    typeAndCast(answer);
    expect(screen.getByRole('status').textContent).toBe('Hit!');
    expect(screen.getByLabelText('5 of 6 monster hit points')).toBeTruthy();
  });

  it('a Miss shows the correct answer for three seconds and costs a heart', () => {
    mount();
    const answer = currentAnswer();
    const prompt = screen.getByText(/=$/).textContent!.replace(/ =$/, '');
    typeAndCast(answer + 1);
    expect(screen.getByRole('status').textContent).toBe(`Miss. ${prompt} = ${answer}`);
    expect(screen.getByLabelText('4 of 5 hearts')).toBeTruthy();
    clearFeedback(FEEDBACK_MS.hit);
    expect(screen.getByRole('status')).toBeTruthy();
    clearFeedback(FEEDBACK_MS.miss - FEEDBACK_MS.hit);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hardware keys type digits, Backspace removes, Enter casts', () => {
    mount();
    fireEvent.keyDown(input(), { key: '5' });
    fireEvent.keyDown(input(), { key: '6' });
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(input().value).toBe('5');
    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(input().value).toBe('');
    fireEvent.keyDown(input(), { key: 'Enter' }); // nothing to cast
    expect(screen.queryByRole('status')).toBeNull();
    for (const d of String(currentAnswer())) fireEvent.keyDown(input(), { key: d });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toBe('Critical Hit!');
  });

  it('calls onFinish with the finished Encounter and save after the last banner clears', () => {
    const { onFinish } = mount();
    for (let i = 0; i < 3; i++) {
      typeAndCast(currentAnswer());
      if (i < 2) clearFeedback(FEEDBACK_MS.hit);
    }
    expect(onFinish).not.toHaveBeenCalled();
    clearFeedback(FEEDBACK_MS.hit);
    expect(onFinish).toHaveBeenCalledTimes(1);
    const [save, encounter] = onFinish.mock.calls[0]!;
    expect(encounter.status).toBe(EncounterStatus.Won);
    expect(save.activeEncounter).toBeNull();
    expect(save.encounters).toHaveLength(1);
    expect(save.character.xp).toBe(12);
  });
});
