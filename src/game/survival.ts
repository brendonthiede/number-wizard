import { EncounterStatus, type Encounter } from '../engine/combat';
import { withEncounter, withSurvivalBest, type SaveData } from '../storage/save';

export const SURVIVAL_MS = 300_000;

export interface SurvivalRun {
  startedAt: number; // epoch ms
  wins: number;
}

/** Creates a scoreless Survival run starting at the supplied time. */
export const startRun = (now: Date): SurvivalRun => ({ startedAt: now.getTime(), wins: 0 });

/** Returns the milliseconds until the run deadline, clamped at zero. */
export const remainingMs = (run: SurvivalRun, now: Date): number =>
  Math.max(0, run.startedAt + SURVIVAL_MS - now.getTime());

/** Formats remaining time as m:ss, rounding up so 0:00 appears only after time expires. */
export function clockText(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Adds a win for a won Encounter and leaves the run unchanged for any other status. */
export const recordRunEncounter = (run: SurvivalRun, encounter: Encounter): SurvivalRun =>
  encounter.status === EncounterStatus.Won ? { ...run, wins: run.wins + 1 } : run;

/**
 * Records an active Encounter with Spells as a Retreat, preserving its XP, or discards one with
 * no Spells. Finished Encounters leave the save unchanged.
 */
export function forfeitEncounter(save: SaveData, encounter: Encounter): SaveData {
  if (encounter.status !== EncounterStatus.Active) return save;
  if (encounter.spells.length === 0) return { ...save, activeEncounter: null };
  return withEncounter(save, { ...encounter, status: EncounterStatus.Retreated }, null);
}

/** Raises the saved Survival best when the run beats it and reports whether a new best was set. */
export function endRun(save: SaveData, run: SurvivalRun): { save: SaveData; newBest: boolean } {
  const newBest = run.wins > save.character.survivalBest;
  return { save: withSurvivalBest(save, run.wins), newBest };
}
