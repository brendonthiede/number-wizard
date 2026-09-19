import { findTemplate } from '../content/quest1';
import { migrate, type SaveData } from '../storage/save';
import { parseLearningPlan, PLAN_KIND, type LearningPlan } from './learningPlan';
import { forfeitEncounter } from './survival';

/** The `kind` tag of an Export file. */
export const EXPORT_KIND = 'number-wizard-export';

/** What an imported file turned out to be. */
export const ImportKind = { Plan: 'plan', Save: 'save' } as const;
export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind];

/** The Guide's raw material: the whole save, tagged and timestamped. */
export interface ExportFile {
  kind: typeof EXPORT_KIND;
  exportedAt: string;
  save: SaveData;
}

/** Wraps the save for download; nothing is summarised or dropped. */
export const buildExport = (save: SaveData, now: Date): ExportFile => ({ kind: EXPORT_KIND, exportedAt: now.toISOString(), save });

/** `number-wizard-<playerId>-<YYYY-MM-DD>.json`, dated in UTC. */
export const exportFileName = (save: SaveData, now: Date): string => `number-wizard-${save.playerId}-${now.toISOString().slice(0, 10)}.json`;

/**
 * Sniffs pasted text: a Learning Plan is parsed strictly, an Export's save goes through `migrate`.
 * An open Encounter whose quest or monster this build no longer has is closed as a Retreat, so
 * restoring an old Export never crashes the Encounter screen on Continue.
 *
 * @throws {Error} with a plain message; never returns a partial result.
 */
export function parseImport(text: string): { kind: typeof ImportKind.Plan; plan: LearningPlan } | { kind: typeof ImportKind.Save; save: SaveData } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('That is not valid JSON.'); }
  const kind = (raw as { kind?: unknown } | null)?.kind;
  if (kind === PLAN_KIND) return { kind: ImportKind.Plan, plan: parseLearningPlan(raw) };
  if (kind === EXPORT_KIND) {
    let save = migrate((raw as { save?: unknown }).save);
    const active = save.activeEncounter;
    if (active && !findTemplate(active.spec.questId, active.spec.monsterId)) {
      save = forfeitEncounter(save, active);
    }
    return { kind: ImportKind.Save, save };
  }
  throw new Error('That is neither a Learning Plan nor an Export.');
}
