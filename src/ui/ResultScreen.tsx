import { levelForXp, titleForLevel } from '../engine/character';
import { EncounterStatus, type Encounter } from '../engine/combat';
import type { Achievement } from '../game/achievements';
import { levelUp, shouldNudgeLabels } from '../game/play';
import type { SaveData } from '../storage/save';
import { LootArt } from './LootArt';
import { useFocusOnMount } from './useFocusOnMount';

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
  earned?: Achievement[];
}

/**
 * Shows the Encounter outcome and XP summary, with the primary button focused for keyboard play.
 * Lists any newly earned Achievement lines under the Loot reveal.
 */
export function ResultScreen({ save, encounter, xpBefore, onAgain, onTitle, saveFailed, continueLabel = 'Fight again', loot, earned = [] }: ResultScreenProps) {
  const primary = useFocusOnMount<HTMLButtonElement>();
  const won = encounter.status === EncounterStatus.Won;
  const level = levelForXp(save.character.xp);
  return (
    <main className="screen result">
      <h1>{won ? 'Victory!' : 'You retreat to fight another day.'}</h1>
      <p className="xp">+{save.character.xp - xpBefore} XP</p>
      {loot && (
        <section className="reveal">
          <LootArt id={loot.id} />
          <p>You found the {loot.name}!{loot.isNew && <span className="badge">New!</span>}</p>
        </section>
      )}
      {earned.map((a) => (
        <p key={a.id} className="achievement-line" role="status">
          <span className="medal-glyph earned" aria-hidden="true" />Achievement: {a.name}
        </p>
      ))}
      {shouldNudgeLabels(encounter) && <p className="nudge" role="status">All your Work was right. Try the next fight with the labels hidden!</p>}
      {levelUp(xpBefore, save.character.xp) && (
        <p className="levelup" role="status">Level up! You are now Level {level}, {titleForLevel(level)}.</p>
      )}
      <p>Level {level} {titleForLevel(level)}</p>
      <button type="button" className="primary" onClick={onAgain} ref={primary}>{continueLabel}</button>
      <button type="button" onClick={onTitle}>Title</button>
      {saveFailed && <p role="status">Progress is not being saved. Ask your Guide for help.</p>}
    </main>
  );
}
