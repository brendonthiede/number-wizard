interface SurvivalResultScreenProps {
  wins: number;
  xpGained: number;
  best: number;
  newBest: boolean;
  onAgain: () => void;
  onTitle: () => void;
  saveFailed?: boolean;
}

export function SurvivalResultScreen({ wins, xpGained, best, newBest, onAgain, onTitle, saveFailed }: SurvivalResultScreenProps) {
  return (
    <main className="screen result">
      <h1>Time's up!</h1>
      <p className="xp">{wins} {wins === 1 ? 'Encounter' : 'Encounters'} won</p>
      <p>+{xpGained} XP</p>
      {newBest ? <p className="levelup" role="status">New best!</p> : <p>Best: {best}</p>}
      <button type="button" className="primary" onClick={onAgain} autoFocus>Run again</button>
      <button type="button" onClick={onTitle}>Title</button>
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
