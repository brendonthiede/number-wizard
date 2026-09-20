// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Achievement } from '../game/achievements';
import { AchievementCarousel, ROTATE_MS } from './AchievementCarousel';

const at = '2026-09-20T12:00:00.000Z';
const three: Achievement[] = [
  { id: 'first-hit', name: 'First Hit', hint: 'Land a Hit.', earnedAt: at },
  { id: 'first-critical', name: 'First Critical Hit', hint: 'Answer fast enough for a Critical Hit.', earnedAt: at },
  { id: 'flawless-encounter', name: 'Flawless', hint: 'Win an Encounter without a Miss.', earnedAt: at },
];
const reducedMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('prefers-reduced-motion'), media: query }));
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const showing = (name: string) => screen.queryByText(`Achievement: ${name}`) !== null;

beforeEach(() => { vi.useFakeTimers(); reducedMotion(false); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('AchievementCarousel', () => {
  it('renders nothing when no Achievement was earned', () => {
    const { container } = render(<AchievementCarousel earned={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a single Achievement with what earned it, and no arrows or count', () => {
    render(<AchievementCarousel earned={[three[2]!]} />);
    expect(showing('Flawless')).toBe(true);
    expect(screen.getByText('Win an Encounter without a Miss.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/ of /)).toBeNull();
    tick(ROTATE_MS * 3);
    expect(showing('Flawless')).toBe(true);
  });

  it('shows one Achievement at a time with a count, and rotates every four seconds, wrapping', () => {
    expect(ROTATE_MS).toBe(4000);
    render(<AchievementCarousel earned={three} />);
    expect(showing('First Hit')).toBe(true);
    expect(showing('First Critical Hit')).toBe(false);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    tick(ROTATE_MS - 1);
    expect(showing('First Hit')).toBe(true);
    tick(1);
    expect(showing('First Critical Hit')).toBe(true);
    expect(screen.getByText('Answer fast enough for a Critical Hit.')).toBeTruthy();
    expect(screen.getByText('2 of 3')).toBeTruthy();
    tick(ROTATE_MS * 2);
    expect(showing('First Hit')).toBe(true);
  });

  it('the arrows move one at a time and wrap both ways', () => {
    render(<AchievementCarousel earned={three} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous Achievement' }));
    expect(showing('Flawless')).toBe(true);
    expect(screen.getByText('3 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next Achievement' }));
    expect(showing('First Hit')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next Achievement' }));
    expect(showing('First Critical Hit')).toBe(true);
  });

  it('using an arrow stops the rotation for good', () => {
    render(<AchievementCarousel earned={three} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next Achievement' }));
    expect(showing('First Critical Hit')).toBe(true);
    tick(ROTATE_MS * 5);
    expect(showing('First Critical Hit')).toBe(true);
  });

  it('focus on an arrow stops the rotation too, so the slide never changes under a keyboard user', () => {
    render(<AchievementCarousel earned={three} />);
    fireEvent.focus(screen.getByRole('button', { name: 'Previous Achievement' }));
    tick(ROTATE_MS * 5);
    expect(showing('First Hit')).toBe(true);
  });

  it('never rotates when the device asks for reduced motion, but the arrows still work', () => {
    reducedMotion(true);
    render(<AchievementCarousel earned={three} />);
    tick(ROTATE_MS * 5);
    expect(showing('First Hit')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next Achievement' }));
    expect(showing('First Critical Hit')).toBe(true);
  });

  it('works where matchMedia does not exist', () => {
    vi.unstubAllGlobals();
    render(<AchievementCarousel earned={three} />);
    tick(ROTATE_MS);
    expect(showing('First Critical Hit')).toBe(true);
  });

  it('is a labelled carousel that stays quiet while it rotates and speaks once the Player drives it', () => {
    render(<AchievementCarousel earned={three} />);
    const group = screen.getByRole('group', { name: 'New Achievements' });
    expect(group.getAttribute('aria-roledescription')).toBe('carousel');
    const slide = screen.getByText('Achievement: First Hit').closest('[aria-live]')!;
    expect(slide.getAttribute('aria-live')).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: 'Next Achievement' }));
    expect(screen.getByText('Achievement: First Critical Hit').closest('[aria-live]')!.getAttribute('aria-live')).toBe('polite');
  });

  it('never points past the end of a list that got shorter', () => {
    const { rerender } = render(<AchievementCarousel earned={three} />);
    tick(ROTATE_MS * 2);
    expect(screen.getByText('3 of 3')).toBeTruthy();
    rerender(<AchievementCarousel earned={three.slice(0, 2)} />);
    // Slide 3 no longer exists; the remainder lands on a real one.
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(showing('First Hit')).toBe(true);
  });
});
