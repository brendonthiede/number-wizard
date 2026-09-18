import { timesTableFacts } from '../engine/timesTable';
import type { FactId, SkillId } from '../engine/types';

/** The `kind` tag of a Learning Plan file. */
export const PLAN_KIND = 'number-wizard-learning-plan';

const SKILLS: SkillId[] = ['times-table', 'multi-digit-multiplication', 'powers', 'long-division'];
const TABLE_IDS = new Set(timesTableFacts().map((f) => f.id));
const KEYS = ['kind', 'version', 'unlockedSkills', 'emphasize', 'thresholds', 'monsterHpScale', 'problems', 'note'];
const LIMITS = { thresholdMin: 1000, thresholdMax: 60000, scaleMin: 0.5, scaleMax: 3, problems: 50, operandMax: 12, note: 2000 };

/** What the Guide imports: every field but `kind` and `version` is optional. It never contains story. */
export interface LearningPlan {
  kind: typeof PLAN_KIND;
  version: 1;
  unlockedSkills?: SkillId[];
  emphasize?: FactId[];
  thresholds?: { 'times-table'?: number };
  monsterHpScale?: number;
  problems?: [number, number][];
  note?: string;
}

/** A plan as the save holds it: explicit Problems are used up by Attempts made after `importedAt`. */
export interface StoredPlan {
  plan: LearningPlan;
  importedAt: string;
}

const fail = (field: string, why: string): never => { throw new Error(`Learning Plan: ${field} ${why}`); };
const inRange = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

/**
 * The trust boundary for a file the Guide pastes in: all-or-nothing, unknown keys rejected, and the
 * result is a fresh object holding only known fields.
 *
 * @throws {Error} naming the first field that is wrong, in plain words.
 */
export function parseLearningPlan(raw: unknown): LearningPlan {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Not a Learning Plan: expected a JSON object');
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(r)) if (!KEYS.includes(key)) fail(key, 'is not a known field');
  if (r.kind !== PLAN_KIND) fail('kind', `must be "${PLAN_KIND}"`);
  if (r.version !== 1) fail('version', 'must be 1');
  const plan: LearningPlan = { kind: PLAN_KIND, version: 1 };

  if (r.unlockedSkills !== undefined) {
    if (!Array.isArray(r.unlockedSkills) || !r.unlockedSkills.every((s) => SKILLS.includes(s as SkillId))) fail('unlockedSkills', 'must list known Skill ids');
    plan.unlockedSkills = [...(r.unlockedSkills as SkillId[])];
  }
  if (r.emphasize !== undefined) {
    if (!Array.isArray(r.emphasize) || !r.emphasize.every((id) => typeof id === 'string' && TABLE_IDS.has(id))) fail('emphasize', 'must list times-table Fact ids such as "tt:7x8"');
    plan.emphasize = [...(r.emphasize as FactId[])];
  }
  if (r.thresholds !== undefined) {
    const t = r.thresholds as Record<string, unknown> | null;
    if (typeof t !== 'object' || t === null || Array.isArray(t) || Object.keys(t).some((k) => k !== 'times-table')) fail('thresholds', 'may only set "times-table"');
    const ms = (t as Record<string, unknown>)['times-table'];
    if (ms !== undefined && !inRange(ms, LIMITS.thresholdMin, LIMITS.thresholdMax)) fail('thresholds', `times-table must be ${LIMITS.thresholdMin} to ${LIMITS.thresholdMax} ms`);
    plan.thresholds = ms === undefined ? {} : { 'times-table': ms as number };
  }
  if (r.monsterHpScale !== undefined) {
    if (!inRange(r.monsterHpScale, LIMITS.scaleMin, LIMITS.scaleMax)) fail('monsterHpScale', `must be ${LIMITS.scaleMin} to ${LIMITS.scaleMax}`);
    plan.monsterHpScale = r.monsterHpScale as number;
  }
  if (r.problems !== undefined) {
    const ok = Array.isArray(r.problems) && r.problems.length <= LIMITS.problems && r.problems.every((p) =>
      Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= LIMITS.operandMax));
    if (!ok) fail('problems', `must be at most ${LIMITS.problems} pairs of whole numbers 0 to ${LIMITS.operandMax}`);
    plan.problems = (r.problems as [number, number][]).map(([a, b]) => [a, b]);
  }
  if (r.note !== undefined) {
    if (typeof r.note !== 'string' || r.note.length > LIMITS.note) fail('note', `must be text of at most ${LIMITS.note} characters`);
    plan.note = r.note as string;
  }
  return plan;
}
