import type { Achievement } from '../game/achievements';
import { useFocusOnMount } from './useFocusOnMount';

interface SurvivalResultScreenProps {
  wins: number;
  xpGained: number;
  best: number;
  newBest: boolean;
  onAgain: () => void;
  onTitle: () => void;
  saveFailed?: boolean;
  earned?: Achievement[];
}

/**
 * Shows Survival totals and best-score status, with "Run again" focused for keyboard play.
 * Lists any newly earned Achievement lines under the XP line.
 */
export function SurvivalResultScreen({ wins, xpGained, best, newBest, onAgain, onTitle, saveFailed, earned = [] }: SurvivalResultScreenProps) {
  const primary = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen result">
      <h1>Time's up!</h1>
      <p className="xp">{wins} {wins === 1 ? 'Encounter' : 'Encounters'} won</p>
      <p>+{xpGained} XP</p>
      {earned.map((a) => (
        <p key={a.id} className="achievement-line" role="status">
          <span className="medal-glyph earned" aria-hidden="true" />Achievement: {a.name}
        </p>
      ))}
      {newBest ? <p className="levelup" role="status">New best!</p> : <p>Best: {best}</p>}
      <button type="button" className="primary" onClick={onAgain} ref={primary}>Run again</button>
      <button type="button" onClick={onTitle}>Title</button>
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
