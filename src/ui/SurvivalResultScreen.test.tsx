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
});
