export const MAX_DIGITS = 4;

// Never keeps a leading zero and never grows past MAX_DIGITS (screens spec invariant 4).
export const appendDigit = (value: string, digit: string): string =>
  value.length >= MAX_DIGITS ? value : value === '0' ? digit : value + digit;

const DIGITS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onCast: () => void;
  disabled?: boolean;
}

export function Keypad({ value, onChange, onCast, disabled = false }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Keypad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className={d === '0' ? 'key key-zero' : 'key'} disabled={disabled} onClick={() => onChange(appendDigit(value, d))}>
          {d}
        </button>
      ))}
      <button type="button" className="key key-back" aria-label="Backspace" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))}>
        ⌫
      </button>
      <button type="button" className="key key-cast" disabled={disabled || !value} onClick={onCast}>
        Cast
      </button>
    </div>
  );
}
