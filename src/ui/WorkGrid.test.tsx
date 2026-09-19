// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Problem } from '../engine/types';
import { WorkGrid } from './WorkGrid';

afterEach(cleanup);

const problem: Problem = {
  factId: 'md:2x1', skill: 'multi-digit-multiplication', prompt: '47 × 6', answer: 282, operands: [47, 6],
  work: [{ label: '6 × 7', value: 42 }, { label: '6 × 40', value: 240 }],
};

function mount(overrides: Partial<Parameters<typeof WorkGrid>[0]> = {}) {
  const props = {
    problem, cells: ['', '', ''], active: 0, onActive: vi.fn(), onChange: vi.fn(), onCast: vi.fn(),
    disabled: false, showLabels: true, onToggleLabels: vi.fn(), marks: null, ...overrides,
  };
  const view = render(<WorkGrid {...props} />);
  return { ...props, ...view };
}
const cell = (n: number) => screen.getByLabelText(`Work cell ${n}`) as HTMLInputElement;
const answer = () => screen.getByLabelText('Answer') as HTMLInputElement;

describe('WorkGrid', () => {
  it('shows the stacked Problem, one input per Work cell, and the answer', () => {
    mount();
    expect(screen.getByRole('math').getAttribute('aria-label')).toBe('47 × 6');
    expect(cell(1)).toBeTruthy();
    expect(cell(2)).toBeTruthy();
    expect(answer()).toBeTruthy();
    expect(screen.queryByLabelText('Work cell 3')).toBeNull();
  });

  it('focuses the active cell, and moves focus when active changes (invariant 8)', () => {
    const p = mount();
    expect(document.activeElement).toBe(cell(1));
    p.rerender(<WorkGrid {...p} active={2} />);
    expect(document.activeElement).toBe(answer());
  });

  it('reports a tapped or tabbed-to cell as active', () => {
    const p = mount();
    fireEvent.focus(cell(2));
    expect(p.onActive).toHaveBeenCalledWith(1);
  });

  it('types digits and Backspace into the focused cell, up to six digits', () => {
    const p = mount({ cells: ['4', '', ''] });
    fireEvent.keyDown(cell(1), { key: '2' });
    expect(p.onChange).toHaveBeenCalledWith(0, '42');
    fireEvent.keyDown(cell(1), { key: 'Backspace' });
    expect(p.onChange).toHaveBeenCalledWith(0, '');
    cleanup();
    const full = mount({ cells: ['123456', '', ''] });
    fireEvent.keyDown(cell(1), { key: '7' });
    expect(full.onChange).toHaveBeenCalledWith(0, '123456');
  });

  it('Enter moves to the next input, and casts from the answer only when it is filled', () => {
    const p = mount();
    fireEvent.keyDown(cell(1), { key: 'Enter' });
    expect(p.onActive).toHaveBeenCalledWith(1);
    fireEvent.keyDown(answer(), { key: 'Enter' });
    expect(p.onCast).not.toHaveBeenCalled();
    cleanup();
    const filled = mount({ cells: ['', '', '282'], active: 2 });
    fireEvent.keyDown(answer(), { key: 'Enter' });
    expect(filled.onCast).toHaveBeenCalledTimes(1);
  });

  it('shows the Work labels and a Hide button, or no labels and a Show button', () => {
    const p = mount();
    expect(screen.getByText('6 × 40')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide labels' }));
    expect(p.onToggleLabels).toHaveBeenCalledTimes(1);
    cleanup();
    mount({ showLabels: false });
    expect(screen.queryByText('6 × 40')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show labels' })).toBeTruthy();
  });

  it('after a cast marks wrong cells and lists the right Work with its labels, even when labels are hidden', () => {
    mount({ cells: ['42', '241', '282'], marks: [true, false], disabled: true, showLabels: false });
    expect(cell(1).className).not.toContain('wrong');
    expect(cell(2).className).toContain('wrong');
    const solution = screen.getByRole('list', { name: 'The right Work' });
    expect(solution.textContent).toContain('6 × 7 = 42');
    expect(solution.textContent).toContain('6 × 40 = 240');
    expect((screen.getByRole('button', { name: 'Show labels' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
