// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SurvivalResultScreen } from './SurvivalResultScreen';

afterEach(cleanup);

describe('SurvivalResultScreen', () => {
  it('shows wins, XP, and the best, and focuses Run again', () => {
    render(<SurvivalResultScreen wins={3} xpGained={36} best={5} newBest={false} onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.getByRole('heading').textContent).toBe("Time's up!");
    expect(screen.getByText('3 Encounters won')).toBeTruthy();
    expect(screen.getByText('+36 XP')).toBeTruthy();
    expect(screen.getByText('Best: 5')).toBeTruthy();
    expect(screen.queryByText('New best!')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Run again' }));
  });

  it('celebrates a new best and uses the singular for one win', () => {
    render(<SurvivalResultScreen wins={1} xpGained={12} best={1} newBest onAgain={() => {}} onTitle={() => {}} />);
    expect(screen.getByText('1 Encounter won')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('New best!');
  });

  it('lists newly earned Achievements under the XP line', () => {
    const earned = [{ id: 'five-criticals', name: 'Five Criticals', hint: 'Land five Critical Hits in one Encounter.', earnedAt: '2026-09-17T12:00:00.000Z' }];
    render(<SurvivalResultScreen wins={2} xpGained={26} best={2} newBest onAgain={() => {}} onTitle={() => {}} earned={earned} />);
    expect(screen.getByText('Achievement: Five Criticals')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Run again' }));
  });
  it('keeps its buttons in the screen navigation, Run again first (pinned navigation)', () => {
    render(<SurvivalResultScreen wins={3} xpGained={36} best={5} newBest={false} onAgain={() => {}} onTitle={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Screen' });
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Run again', 'Title']);
    expect(nav.textContent).not.toContain('XP');
  });
});
