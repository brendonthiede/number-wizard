import { levelForXp, titleForLevel } from '../engine/character';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { levelUp } from '../game/play';
import type { SaveData } from '../storage/save';
import { LootArt } from './LootArt';

/** What the result screen reveals after a Quest win: the Loot id, its display name, and whether it is a first find. */
export interface LootReveal {
  id: string;
  name: string;
  isNew: boolean;
}

interface ResultScreenProps {
  save: SaveData;
  encounter: Encounter;
  xpBefore: number;
  onAgain: () => void;
  onTitle: () => void;
  saveFailed?: boolean;
  continueLabel?: string;
  loot?: LootReveal;
}

/** Shows the Encounter outcome and XP summary, with the primary button focused for keyboard play. */
export function ResultScreen({ save, encounter, xpBefore, onAgain, onTitle, saveFailed, continueLabel = 'Fight again', loot }: ResultScreenProps) {
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
      {loot && (
        <section className="reveal">
          <LootArt id={loot.id} />
          <p>You found the {loot.name}!{loot.isNew && <span className="badge">New!</span>}</p>
        </section>
      )}
      <button type="button" className="primary" onClick={onAgain} autoFocus>{continueLabel}</button>
      <button type="button" onClick={onTitle}>Title</button>
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
