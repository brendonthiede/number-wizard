// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreateScreen } from './CreateScreen';

afterEach(cleanup);

const begin = () => screen.getByRole('button', { name: 'Begin' }) as HTMLButtonElement;

describe('CreateScreen', () => {
  it('enables Begin only once a name and a portrait are chosen, then reports both', () => {
    const onBegin = vi.fn();
    render(<CreateScreen onBegin={onBegin} />);
    expect(begin().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Noah ' } });
    expect(begin().disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'character-02' }));
    expect(begin().disabled).toBe(false);
    fireEvent.click(begin());
    expect(onBegin).toHaveBeenCalledWith('Noah', 'character-02');
  });

  it('offers the three portraits and marks the chosen one', () => {
    render(<CreateScreen onBegin={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: 'character-03' }));
    expect(screen.getByRole('radio', { name: 'character-03' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'character-01' }).getAttribute('aria-checked')).toBe('false');
  });
});
