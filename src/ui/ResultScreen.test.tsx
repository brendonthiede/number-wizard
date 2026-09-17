// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import { QUEST_1_FIRST } from '../content';
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
});
