import { useEffect, useRef, type KeyboardEvent } from 'react';
import { appendDigit } from './Keypad';

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onCast: () => void;
  disabled: boolean;
  focusKey: unknown;
}

// A real input so hardware typing needs no tap and Tab has somewhere to go once Work cells exist;
// inputMode="none" keeps a touch device's own keyboard away. Focus returns whenever the input
// re-enables or a new Problem (focusKey) appears.
export function AnswerInput({ value, onChange, onCast, disabled, focusKey }: AnswerInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled, focusKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (/^\d$/.test(e.key)) onChange(appendDigit(value, e.key));
    else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    else if (e.key === 'Enter' && value) onCast();
    else return;
    e.preventDefault();
  };

  return <input ref={ref} className="answer" inputMode="none" aria-label="Answer" value={value} readOnly disabled={disabled} onKeyDown={onKeyDown} />;
}
