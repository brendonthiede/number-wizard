import type { Region } from '../content/map';
import { QUESTS, type Quest, type QuestEncounter } from '../content/quest1';
import type { SaveData } from '../storage/save';
import { EncounterState, questComplete, questOpen, questProgress } from './quest';

/** What a region shows on the Map: Fogged until its Quest can start, Open while it is played, Complete when won. */
export const RegionState = { Fogged: 'fogged', Open: 'open', Complete: 'complete' } as const;
export type RegionState = (typeof RegionState)[keyof typeof RegionState];

/** The Quest behind a region, or undefined while the Skill has none. */
export const questFor = (region: Region): Quest | undefined => QUESTS.find((q) => q.id === region.questId);

/** A region with no Quest is Fogged whatever a Learning Plan unlocks: there is nothing to start. */
export function regionState(save: SaveData, region: Region): RegionState {
  const quest = questFor(region);
  if (!quest) return RegionState.Fogged;
  if (questComplete(save, quest)) return RegionState.Complete;
  return questOpen(save, quest) ? RegionState.Open : RegionState.Fogged;
}

/** The line under a Fogged region: only the Learning Plan lifts Fog from a Quest, and nothing lifts it where no Quest exists. */
export const fogLine = (region: Region): string =>
  region.questId === null ? 'Nothing lives here yet.' : 'The Guide holds the key.';

/** Won Encounters out of the Quest's Encounters; a monster won twice counts once. Null with no Quest. */
export function regionProgress(save: SaveData, region: Region): { won: number; total: number } | null {
  const quest = questFor(region);
  if (!quest) return null;
  const states = questProgress(save, quest);
  return { won: states.filter((s) => s === EncounterState.Won).length, total: states.length };
}

/** A Free Roam fight: one of the Quest's own Encounters, so it records, drops Loot and routes like any fight in that Quest. */
export function freeRoamTemplate(quest: Quest, rng: () => number = Math.random): QuestEncounter {
  const i = Math.min(quest.encounters.length - 1, Math.max(0, Math.floor(rng() * quest.encounters.length)));
  return quest.encounters[i]!;
}

/** Whether the fight between `before` and `after` completed the Quest. The closing panel shows only then, never on a replay. */
export const completesQuest = (before: SaveData, after: SaveData, quest: Quest): boolean =>
  !questComplete(before, quest) && questComplete(after, quest);
