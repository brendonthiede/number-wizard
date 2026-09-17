// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SurvivalResultScreen } from './SurvivalResultScreen';

afterEach(cleanup);

describe('SurvivalResultScreen', () => {
  it('lists newly earned Achievements under the XP line', () => {
    const earned = [{ id: 'five-criticals', name: 'Five Criticals', hint: 'Land five Critical Hits in one Encounter.', earnedAt: '2026-09-17T12:00:00.000Z' }];
    render(<SurvivalResultScreen wins={2} xpGained={26} best={2} newBest onAgain={() => {}} onTitle={() => {}} earned={earned} />);
    expect(screen.getByText('Achievement: Five Criticals')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Run again' }));
  });
});
