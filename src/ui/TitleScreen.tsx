import { APP_TITLE } from '../content';
import { levelForXp, titleForLevel } from '../engine/character';
import type { SaveData } from '../storage/save';
import { art } from './art';

interface TitleScreenProps {
  save: SaveData;
  onPlay: () => void;
  onSurvival: () => void;
  onLoot: () => void;
  onTrophies?: () => void;
  saveFailed?: boolean;
}

/** Shows the Character summary and entry points for normal and Survival play. */
export function TitleScreen({ save, onPlay, onSurvival, onLoot, onTrophies, saveFailed }: TitleScreenProps) {
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen title">
      <h1>{APP_TITLE}</h1>
      <img className="portrait" src={art(`character/${save.character.portrait}.png`)} alt="" />
      <p>{save.character.name}, {titleForLevel(level)} (Level {level})</p>
      <button type="button" className="primary" onClick={onPlay}>{save.activeEncounter ? 'Continue' : 'Play'}</button>
      {onTrophies ? <button type="button" onClick={onTrophies}>Trophy Case</button> : <button type="button" onClick={onLoot}>Loot</button>}
      <button type="button" onClick={onSurvival}>Survival</button>
      {save.character.survivalBest > 0 && <p>Survival best: {save.character.survivalBest}</p>}
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
