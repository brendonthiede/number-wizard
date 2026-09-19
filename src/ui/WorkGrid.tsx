import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Problem } from '../engine/types';
import { appendDigit, GRID_MAX_DIGITS } from './Keypad';

interface WorkGridProps {
  problem: Problem;
  cells: string[]; // one per Work cell, then the answer last
  active: number;
  onActive: (index: number) => void;
  onChange: (index: number, value: string) => void;
  onCast: () => void;
  disabled: boolean;
  showLabels: boolean;
  onToggleLabels: () => void;
  marks: boolean[] | null; // per Work cell after a cast; null while answering
}

/**
 * The Work grid: the stacked Problem, one input per partial product, and the answer. Fully
 * controlled. Inputs are read-only with inputMode="none" so a touch device's own keyboard stays
 * away while hardware typing, Tab and the on-screen keypad all work.
 */
export function WorkGrid({ problem, cells, active, onActive, onChange, onCast, disabled, showLabels, onToggleLabels, marks }: WorkGridProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const last = cells.length - 1;
  useEffect(() => {
    if (!disabled) refs.current[active]?.focus();
  }, [active, disabled, problem]);

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    const value = cells[i] ?? '';
    if (/^\d$/.test(e.key)) onChange(i, appendDigit(value, e.key, GRID_MAX_DIGITS));
    else if (e.key === 'Backspace') onChange(i, value.slice(0, -1));
    else if (e.key === 'Enter') {
      if (i < last) onActive(i + 1);
      else if (value) onCast();
    } else return;
    e.preventDefault();
  };

  const input = (i: number, label: string, className: string) => (
    <input
      ref={(el) => { refs.current[i] = el; }}
      className={className}
      inputMode="none"
      aria-label={label}
      value={cells[i] ?? ''}
      readOnly
      disabled={disabled}
      onFocus={() => onActive(i)}
      onKeyDown={onKeyDown(i)}
    />
  );

  const [a, b] = problem.operands!;
  const work = problem.work!;
  return (
    <div className="work-grid">
      <div className="stacked" role="math" aria-label={problem.prompt}>
        <span>{a}</span>
        <span>× {b}</span>
      </div>
      <button type="button" className="labels-toggle" onClick={onToggleLabels} disabled={disabled}>
        {showLabels ? 'Hide labels' : 'Show labels'}
      </button>
      {work.map((c, i) => (
        <div key={i} className="work-row">
          {showLabels && <span className="work-label">{c.label}</span>}
          {input(i, `Work cell ${i + 1}`, marks && !marks[i] ? 'answer work-cell wrong' : 'answer work-cell')}
        </div>
      ))}
      <div className="work-row work-answer">
        {input(last, 'Answer', 'answer')}
      </div>
      {marks && (
        <ul className="work-solution" aria-label="The right Work">
          {work.map((c, i) => <li key={i}>{c.label} = {c.value}</li>)}
        </ul>
      )}
    </div>
  );
}
