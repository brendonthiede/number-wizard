import { levelForXp, titleForLevel } from '../engine/character';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { levelUp } from '../game/play';
import type { SaveData } from '../storage/save';

interface ResultScreenProps {
  save: SaveData;
  encounter: Encounter;
  xpBefore: number;
  onAgain: () => void;
  onTitle: () => void;
}

export function ResultScreen({ save, encounter, xpBefore, onAgain, onTitle }: ResultScreenProps) {
  const won = encounter.status === EncounterStatus.Won;
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen result">
      <h1>{won ? 'Victory!' : 'You retreat to fight another day.'}</h1>
      <p className="xp">+{save.character.xp - xpBefore} XP</p>
      {levelUp(xpBefore, save.character.xp) && (
        <p className="levelup" role="status">Level up! You are now Level {level}, {titleForLevel(level)}.</p>
      )}
      <p>Level {level} {titleForLevel(level)}</p>
      <button type="button" className="primary" onClick={onAgain}>Fight again</button>
      <button type="button" onClick={onTitle}>Title</button>
    </main>
  );
}
