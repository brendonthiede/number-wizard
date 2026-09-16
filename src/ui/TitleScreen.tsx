import { APP_TITLE } from '../content';
import { levelForXp, titleForLevel } from '../engine/character';
import type { SaveData } from '../storage/save';
import { art } from './art';

interface TitleScreenProps {
  save: SaveData;
  onPlay: () => void;
  saveFailed?: boolean;
}

export function TitleScreen({ save, onPlay, saveFailed }: TitleScreenProps) {
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen title">
      <h1>{APP_TITLE}</h1>
      <img className="portrait" src={art(`character/${save.character.portrait}.png`)} alt="" />
      <p>{save.character.name}, {titleForLevel(level)} (Level {level})</p>
      <button type="button" className="primary" onClick={onPlay}>{save.activeEncounter ? 'Continue' : 'Play'}</button>
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
