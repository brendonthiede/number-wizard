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

  it('appendDigit takes a digit cap, defaulting to four', () => {
    expect(appendDigit('1234', '5')).toBe('1234');
    expect(appendDigit('1234', '5', 6)).toBe('12345');
    expect(appendDigit('123456', '7', 6)).toBe('123456');
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

  it('places every digit in its own grid area so the layout is a telephone keypad', () => {
    render(<Harness onCast={() => {}} />);
    for (const d of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']) {
      expect((screen.getByRole('button', { name: d }) as HTMLButtonElement).style.gridArea).toBe(`k${d}`);
    }
  });

  it('shows a Next key only when given onNext, and lets canCast override the Cast rule', () => {
    const onNext = vi.fn();
    const { rerender } = render(<Keypad value="" onChange={() => {}} onCast={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    rerender(<Keypad value="" onChange={() => {}} onCast={() => {}} onNext={onNext} canCast />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<Keypad value="12" onChange={() => {}} onCast={() => {}} onNext={onNext} canCast={false} />);
    expect((screen.getByRole('button', { name: 'Cast' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses maxDigits when typing', () => {
    const onChange = vi.fn();
    render(<Keypad value="1234" onChange={onChange} onCast={() => {}} maxDigits={6} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenCalledWith('12345');
  });
});
