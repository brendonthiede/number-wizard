// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import { QUEST_1_FIRST } from '../content';
import { QUEST_2 } from '../content/quest2';
import { beginEncounter, cast, nextProblem } from '../game/play';
import { emptySave, withCharacter } from '../storage/save';

afterEach(cleanup);

const NOW = new Date('2026-09-16T12:00:00.000Z');

describe('ResultScreen', () => {
  it('focuses Fight again so Enter starts the next Encounter', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fight again' }));
  });

  it('labels the primary button as asked, defaulting to Fight again', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} continueLabel="Continue" />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('button', { name: 'Fight again' })).toBeNull();
  });

  it('reveals the Loot found with a New! badge on a first find, and nothing without a drop (invariant 5)', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    const { unmount } = render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} loot={{ id: 'star-hat', name: 'Star Hat', isNew: true }} />);
    expect(screen.getByText('You found the Star Hat!')).toBeTruthy();
    expect(screen.getByText('New!')).toBeTruthy();
    unmount();
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} loot={{ id: 'star-hat', name: 'Star Hat', isNew: false }} />);
    expect(screen.getByText('You found the Star Hat!')).toBeTruthy();
    expect(screen.queryByText('New!')).toBeNull();
    cleanup();
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.queryByText(/You found/)).toBeNull();
  });

  it('lists newly earned Achievements under the Loot reveal', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    let { save, encounter } = beginEncounter(base, { ...QUEST_1_FIRST, monsterMaxHp: 1 }, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save, encounter } = cast(save, encounter, QUEST_1_FIRST, p, p.answer, 1000, NOW, () => 0.5));
    const earned = [{ id: 'first-hit', name: 'First Hit', hint: 'Land a Hit.', earnedAt: NOW.toISOString() }];
    render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} earned={earned} />);
    expect(screen.getByText('Achievement: First Hit')).toBeTruthy();
  });

  it('suggests hiding the Work labels after a win where they were shown and all Work was right', () => {
    const base = withCharacter(emptySave('noah'), 'Noah', 'character-01');
    const Q2 = QUEST_2.encounters[0]!;
    let { save, encounter } = beginEncounter(base, { ...Q2, monsterMaxHp: 1 }, NOW, 'e1');
    const p = { factId: 'md:2x1', skill: 'multi-digit-multiplication' as const, prompt: '12 × 3', answer: 36, operands: [12, 3] as [number, number], work: [{ label: '3 × 2', value: 6 }, { label: '3 × 10', value: 30 }] };
    ({ save, encounter } = cast(save, encounter, Q2, p, 36, 60000, NOW, () => 0, { entered: [30, 6], labelsShown: true }));
    const { rerender } = render(<ResultScreen save={save} encounter={encounter} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.getByText('All your Work was right. Try the next fight with the labels hidden!')).toBeTruthy();
    const hidden = { ...encounter, spells: encounter.spells.map((s) => ({ ...s, labelsShown: false })) };
    rerender(<ResultScreen save={save} encounter={hidden} xpBefore={0} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.queryByText(/labels hidden/)).toBeNull();
  });
});
