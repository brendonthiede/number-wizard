// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { appendDigit, Keypad, MAX_DIGITS } from './Keypad';

afterEach(cleanup);

function Harness({ onCast, disabled = false }: { onCast: (value: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <>
      <output data-testid="value">{value}</output>
      <Keypad value={value} onChange={setValue} onCast={() => onCast(value)} disabled={disabled} />
    </>
  );
}

describe('appendDigit', () => {
  it('never exceeds MAX_DIGITS and never keeps a leading zero (invariant 4)', () => {
    expect(appendDigit('', '0')).toBe('0');
    expect(appendDigit('0', '5')).toBe('5');
    expect(appendDigit('0', '0')).toBe('0');
    expect(appendDigit('12', '3')).toBe('123');
    expect(appendDigit('1234', '5')).toBe('1234');
    expect(MAX_DIGITS).toBe(4);
  });
});

describe('Keypad', () => {
  it('builds the answer from taps, removes with Backspace, and casts the value', () => {
    const onCast = vi.fn();
    render(<Harness onCast={onCast} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(screen.getByTestId('value').textContent).toBe('56');
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));
    expect(onCast).toHaveBeenCalledWith('56');
  });

  it('disables Cast and Backspace while the answer is empty', () => {
    render(<Harness onCast={() => {}} />);
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Backspace' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables every key when disabled', () => {
    render(<Harness onCast={() => {}} disabled />);
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
