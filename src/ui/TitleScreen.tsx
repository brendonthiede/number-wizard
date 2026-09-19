import { APP_TITLE } from '../content';
import { levelForXp, titleForLevel } from '../engine/character';
import type { SaveData } from '../storage/save';
import { art } from './art';

interface TitleScreenProps {
  save: SaveData;
  onPlay: () => void;
  onSurvival: () => void;
  onTrophies: () => void;
  onGuide: () => void;
  saveFailed?: boolean;
}

/** Shows the Character summary and entry points for normal play, Survival, the Trophy Case, and the Guide screen. */
export function TitleScreen({ save, onPlay, onSurvival, onTrophies, onGuide, saveFailed }: TitleScreenProps) {
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen title">
      <button type="button" className="gear" aria-label="Guide" onClick={onGuide}>⚙</button>
      <h1>{APP_TITLE}</h1>
      <img className="portrait" src={art(`character/${save.character.portrait}.png`)} alt="" />
      <p>{save.character.name}, {titleForLevel(level)} (Level {level})</p>
      <button type="button" className="primary" onClick={onPlay}>{save.activeEncounter ? 'Continue' : 'Play'}</button>
      <button type="button" onClick={onTrophies}>Trophy Case</button>
      <button type="button" onClick={onSurvival}>Survival</button>
      {save.character.survivalBest > 0 && <p>Survival best: {save.character.survivalBest}</p>}
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
