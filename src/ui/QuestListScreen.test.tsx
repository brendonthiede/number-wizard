// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import { QuestListScreen } from './QuestListScreen';

afterEach(cleanup);

describe('QuestListScreen', () => {
  it('lists the open Quests by name, focuses the newest, and reports a pick', () => {
    const onPick = vi.fn();
    const onTitle = vi.fn();
    render(<QuestListScreen quests={[QUEST_1, QUEST_2]} onPick={onPick} onTitle={onTitle} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'The Golem Foundry' }));
    fireEvent.click(screen.getByRole('button', { name: 'The Fortress of Twelves' }));
    expect(onPick).toHaveBeenCalledWith(QUEST_1);
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));
    expect(onTitle).toHaveBeenCalledTimes(1);
  });
});
