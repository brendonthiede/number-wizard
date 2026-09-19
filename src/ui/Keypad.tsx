export const MAX_DIGITS = 4;
export const GRID_MAX_DIGITS = 6; // 99 × 99 is four digits; six leaves room to fix a slip without blocking

/** Appends a digit. Never keeps a leading zero and never grows past `max` (screens spec invariant 4). */
export const appendDigit = (value: string, digit: string, max: number = MAX_DIGITS): string =>
  value.length >= max ? value : value === '0' ? digit : value + digit;

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onCast: () => void;
  disabled?: boolean;
  onNext?: () => void;
  maxDigits?: number;
  canCast?: boolean;
}

/** The on-screen keypad. It types into whatever value it is given; a Work grid also gets a Next key. */
export function Keypad({ value, onChange, onCast, disabled = false, onNext, maxDigits = MAX_DIGITS, canCast }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Keypad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className="key" style={{ gridArea: `k${d}` }} disabled={disabled} onClick={() => onChange(appendDigit(value, d, maxDigits))}>
          {d}
        </button>
      ))}
      <button type="button" className="key key-back" aria-label="Backspace" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))}>
        ⌫
      </button>
      {onNext && (
        <button type="button" className="key key-next" disabled={disabled} onClick={onNext}>
          Next
        </button>
      )}
      <button type="button" className="key key-cast" disabled={disabled || !(canCast ?? Boolean(value))} onClick={onCast}>
        Cast
      </button>
    </div>
  );
}
