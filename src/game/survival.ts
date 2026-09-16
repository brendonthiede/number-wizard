import { EncounterStatus, type Encounter } from '../engine/combat';
import { withEncounter, withSurvivalBest, type SaveData } from '../storage/save';

export const SURVIVAL_MS = 300_000;

export interface SurvivalRun {
  startedAt: number; // epoch ms
  wins: number;
}

export const startRun = (now: Date): SurvivalRun => ({ startedAt: now.getTime(), wins: 0 });

export const remainingMs = (run: SurvivalRun, now: Date): number =>
  Math.max(0, run.startedAt + SURVIVAL_MS - now.getTime());

// Rounded up: the clock reads 0:00 only once the run is actually over.
export function clockText(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const recordRunEncounter = (run: SurvivalRun, encounter: Encounter): SurvivalRun =>
  encounter.status === EncounterStatus.Won ? { ...run, wins: run.wins + 1 } : run;

// The clock ends a fight as a Retreat: XP earned stays, the monster heals. A fight with no Spell
// cast leaves no trace, so no Attempt can point at a record that never existed.
export function forfeitEncounter(save: SaveData, encounter: Encounter): SaveData {
  if (encounter.status !== EncounterStatus.Active) return save;
  if (encounter.spells.length === 0) return { ...save, activeEncounter: null };
  return withEncounter(save, { ...encounter, status: EncounterStatus.Retreated }, null);
}

export function endRun(save: SaveData, run: SurvivalRun): { save: SaveData; newBest: boolean } {
  const newBest = run.wins > save.character.survivalBest;
  return { save: withSurvivalBest(save, run.wins), newBest };
}
