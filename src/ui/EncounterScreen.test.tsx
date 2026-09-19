// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EncounterScreen, FEEDBACK_MS } from './EncounterScreen';
import { beginEncounter } from '../game/play';
import { QUEST_1_FIRST } from '../content';
import { QUEST_2 } from '../content/quest2';
import { EncounterStatus } from '../engine/combat';
import { timesTableFacts } from '../engine/timesTable';
import type { Attempt } from '../engine/types';
import { parseLearningPlan, PLAN_KIND } from '../game/learningPlan';
import { emptySave, withCharacter, withLearningPlan, type SaveData } from '../storage/save';

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

  it('records a zero duration when the device clock steps back mid-Problem', () => {
    const { onSave } = mount();
    t -= 5000;
    typeAndCast(currentAnswer());
    const saved = onSave.mock.calls[0]![0];
    expect(saved.attempts[0].durationMs).toBe(0);
  });

  it('shows a clock in the status row only when given one', () => {
    mount();
    expect(screen.queryByRole('timer')).toBeNull();
    cleanup();
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    const { save, encounter } = beginEncounter(base, QUEST_1_FIRST, now(), 'e2');
    render(<EncounterScreen save={save} encounter={encounter} template={QUEST_1_FIRST} onSave={() => {}} onFinish={() => {}} now={now} rng={rng} clock="4:59" />);
    expect(screen.getByRole('timer').textContent).toBe('4:59');
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

describe('EncounterScreen with a Work grid', () => {
  const Q2 = QUEST_2.encounters[0]!;
  // Every table Fact Mastered just now, so Quest 2 serves only grids.
  const gridOnly = (hide = false): SaveData => {
    const attempts: Attempt[] = [];
    for (const f of timesTableFacts()) {
      for (let i = 0; i < 3; i++) attempts.push({ factId: f.id, answer: f.a * f.b, correct: true, durationMs: 900, at: new Date(T0).toISOString(), encounterId: 'old', outcome: 'critical' });
    }
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    return { ...base, attempts, settings: { hideWorkLabels: hide } };
  };
  function mountGrid(start: SaveData = gridOnly(), hp = 50) {
    const onSave = vi.fn();
    const onFinish = vi.fn();
    const { save, encounter } = beginEncounter(start, { ...Q2, monsterMaxHp: hp }, now(), 'e1');
    render(<EncounterScreen save={save} encounter={encounter} template={Q2} onSave={onSave} onFinish={onFinish} now={now} rng={rng} />);
    return { onSave, onFinish };
  }
  const cell = (n: number) => screen.getByLabelText(`Work cell ${n}`) as HTMLInputElement;
  const key = (d: string) => fireEvent.click(screen.getByRole('button', { name: d }));
  const type = (n: number) => { for (const d of String(n)) key(d); };
  const operands = () => screen.getByRole('math').getAttribute('aria-label')!.match(/\d+/g)!.map(Number) as [number, number];
  const partials = () => { const [a, b] = operands(); return [b * (a % 10), b * (a - (a % 10))]; }; // 2×1 only
  const lastAttempt = (onSave: ReturnType<typeof vi.fn>) => (onSave.mock.calls.at(-1)![0] as SaveData).attempts.at(-1)!;

  it('shows the grid with focus on the first Work cell (invariant 8)', () => {
    mountGrid();
    expect(document.activeElement).toBe(cell(1));
    expect(screen.queryByText(/=$/)).toBeNull();
  });

  it('types into the focused cell, moves on with Next, and any order of right Work is a Hit', () => {
    const { onSave } = mountGrid();
    const [ones, tens] = partials();
    const [a, b] = operands();
    type(tens!);
    expect(cell(1).value).toBe(String(tens));
    key('Next');
    expect(document.activeElement).toBe(cell(2));
    type(ones!);
    key('Next');
    expect(document.activeElement).toBe(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(['hit', 'critical']).toContain(lastAttempt(onSave).outcome);
    expect(lastAttempt(onSave)).toMatchObject({ operands: [a, b], work: [tens, ones], labelsShown: true });
    // Only the keypad's own Next key: a Hit does not wait for the Player.
    expect(screen.queryByRole('button', { name: 'Next Problem' })).toBeNull();
  });

  it("the keypad's Next key wraps from the answer back to the first Work cell (F6)", () => {
    mountGrid();
    expect(document.activeElement).toBe(cell(1));
    key('Next');
    key('Next');
    key('Next');
    expect(document.activeElement).toBe(cell(1));
  });

  it('a Hit with all Work right never shows the right Work list (F1)', () => {
    const { onSave } = mountGrid();
    const [ones, tens] = partials();
    const [a, b] = operands();
    type(tens!);
    key('Next');
    type(ones!);
    key('Next');
    type(a * b);
    key('Cast');
    expect(['hit', 'critical']).toContain(lastAttempt(onSave).outcome);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'The right Work' })).toBeNull();
  });

  it('Cast needs only the answer; empty Work is a Glancing Blow that waits for Next', () => {
    const { onSave } = mountGrid();
    const [a, b] = operands();
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(lastAttempt(onSave)).toMatchObject({ outcome: 'glancing', work: [null, null] });
    expect(screen.getByRole('status').textContent).toBe('Glancing Blow!');
    expect(screen.getByRole('list', { name: 'The right Work' })).toBeTruthy();
    expect(cell(1).className).toContain('wrong');
    clearFeedback(60_000);
    expect(screen.getByRole('status').textContent).toBe('Glancing Blow!');
    const next = screen.getByRole('button', { name: 'Next Problem' });
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    expect(screen.queryByRole('status')).toBeNull();
    expect(cell(1).value).toBe('');
    expect(document.activeElement).toBe(cell(1));
  });

  it('a Miss on a grid shows the answer and the right Work, and waits for Next', () => {
    mountGrid();
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b + 1);
    key('Cast');
    expect(screen.getByRole('status').textContent).toBe(`Miss. ${a} × ${b} = ${a * b}`);
    expect(screen.getByRole('list', { name: 'The right Work' })).toBeTruthy();
    clearFeedback(60_000);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('hiding the labels saves the setting at once, and the Attempt still says they were shown (invariants 4 and 5)', () => {
    const { onSave } = mountGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Hide labels' }));
    expect((onSave.mock.calls.at(-1)![0] as SaveData).settings.hideWorkLabels).toBe(true);
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(lastAttempt(onSave).labelsShown).toBe(true);
  });

  it('with labels hidden by default, a Problem records labelsShown false', () => {
    const { onSave } = mountGrid(gridOnly(true));
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(lastAttempt(onSave).labelsShown).toBe(false);
  });

  it('a peek lasts one Problem, never changes the setting, and is recorded even if closed again (invariants 4 and 5)', () => {
    const { onSave } = mountGrid(gridOnly(true));
    fireEvent.click(screen.getByRole('button', { name: 'Show labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide labels' }));
    expect(onSave).not.toHaveBeenCalled();
    const [ones, tens] = partials();
    const [a, b] = operands();
    type(ones!); key('Next'); type(tens!); key('Next'); type(a * b);
    key('Cast');
    const saved = onSave.mock.calls.at(-1)![0] as SaveData;
    expect(saved.attempts.at(-1)!.labelsShown).toBe(true);
    expect(saved.settings.hideWorkLabels).toBe(true);
    clearFeedback(FEEDBACK_MS.hit);
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
  });

  it('a table Problem inside Quest 2 uses the single answer box, focused (invariant 8)', () => {
    const plan = parseLearningPlan({ kind: PLAN_KIND, version: 1, problems: [[7, 8]] });
    // Import must postdate the pre-seeded mastery Attempts (all at T0), or pendingExplicit counts
    // them as post-import and treats the explicit Problem as already used (learningPlan.test.ts).
    mountGrid(withLearningPlan(gridOnly(), plan, new Date(T0 + 1000)));
    expect(screen.getByText('7 × 8 =')).toBeTruthy();
    expect(screen.queryByRole('math')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Answer'));
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('finishes the Encounter from the Next button after a final Glancing Blow', () => {
    const { onFinish } = mountGrid(gridOnly(), 1);
    const [a, b] = operands();
    fireEvent.focus(screen.getByLabelText('Answer'));
    type(a * b);
    key('Cast');
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next Problem' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
