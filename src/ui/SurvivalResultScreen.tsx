import type { Achievement } from '../game/achievements';
import { useFocusOnMount } from './useFocusOnMount';
import { AchievementCarousel } from './AchievementCarousel';
import { ScreenNav } from './ScreenNav';

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
      <div className="screen-body">
      <h1>Time's up!</h1>
      <p className="xp">{wins} {wins === 1 ? 'Encounter' : 'Encounters'} won</p>
      <p>+{xpGained} XP</p>
      <AchievementCarousel earned={earned} />
      {newBest ? <p className="levelup" role="status">New best!</p> : <p>Best: {best}</p>}
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
      </div>
      <ScreenNav>
        <button type="button" className="primary" onClick={onAgain} ref={primary}>Run again</button>
        <button type="button" onClick={onTitle}>Title</button>
      </ScreenNav>
    </main>
  );
}
