// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClosingPanelScreen } from './ClosingPanelScreen';
import { StoryPanelScreen } from './StoryPanelScreen';
import { QUEST_1 } from '../content/quest1';

afterEach(cleanup);

describe('StoryPanelScreen', () => {
  it('shows the panel text over the Quest background with the monster, and focuses Fight', () => {
    const onFight = vi.fn();
    const knight = QUEST_1.encounters[1]!;
    const { container } = render(<StoryPanelScreen quest={QUEST_1} encounter={knight} onFight={onFight} />);
    expect(screen.getByText(knight.story.text)).toBeTruthy();
    expect((container.querySelector('.panel') as HTMLElement).style.backgroundImage).toContain('castle-02');
    expect((container.querySelector('img.monster') as HTMLImageElement).getAttribute('src')).toContain('fourmidable-knight');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
    expect(onFight).toHaveBeenCalled();
  });
});

describe('ClosingPanelScreen', () => {
  it('shows the closing text and focuses Title', () => {
    const onTitle = vi.fn();
    render(<ClosingPanelScreen quest={QUEST_1} onTitle={onTitle} />);
    expect(screen.getByText(QUEST_1.closing.text)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Title' }));
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalled();
  });
  it('both panels keep their button in the screen navigation, apart from the story (pinned navigation)', () => {
    render(<StoryPanelScreen quest={QUEST_1} encounter={QUEST_1.encounters[1]!} onFight={() => {}} />);
    let nav = screen.getByRole('navigation', { name: 'Screen' });
    expect(nav.contains(screen.getByRole('button', { name: 'Fight' }))).toBe(true);
    expect(nav.textContent).not.toContain(QUEST_1.encounters[1]!.story.text);
    cleanup();
    render(<ClosingPanelScreen quest={QUEST_1} onTitle={() => {}} />);
    nav = screen.getByRole('navigation', { name: 'Screen' });
    expect(nav.contains(screen.getByRole('button', { name: 'Title' }))).toBe(true);
    expect(nav.textContent).not.toContain(QUEST_1.closing.text);
  });
});
