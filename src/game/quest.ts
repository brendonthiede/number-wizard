import type { Quest } from '../content/quest1';
import { EncounterStatus } from '../engine/combat';
import type { SaveData } from '../storage/save';

/** An Encounter's place on the Quest screen: Locked behind an unwon fight, Open to play, or Won and replayable. */
export const EncounterState = { Locked: 'locked', Open: 'open', Won: 'won' } as const;
export type EncounterState = (typeof EncounterState)[keyof typeof EncounterState];

/** Derives each Encounter's state from the save's records: Won, the first not-won is Open, the rest Locked. */
export function questProgress(save: SaveData, quest: Quest): EncounterState[] {
  const won = new Set(
    save.encounters.filter((r) => r.questId === quest.id && r.status === EncounterStatus.Won).map((r) => r.monsterId),
  );
  let opened = false;
  return quest.encounters.map((e) => {
    if (won.has(e.monsterId)) return EncounterState.Won;
    if (opened) return EncounterState.Locked;
    opened = true;
    return EncounterState.Open;
  });
}

/** True once every Encounter, the boss included, has been won. */
export const questComplete = (save: SaveData, quest: Quest): boolean =>
  questProgress(save, quest).every((s) => s === EncounterState.Won);

/** The row to focus on the Quest screen: the first open Encounter, or the boss once the Quest is complete. */
export function nextOpenIndex(save: SaveData, quest: Quest): number {
  const i = questProgress(save, quest).indexOf(EncounterState.Open);
  return i === -1 ? quest.encounters.length - 1 : i;
}
