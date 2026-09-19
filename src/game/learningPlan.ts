import { isTierId, tierById, TIERS, type TierId } from '../engine/multiDigit';
import { TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { factId, timesTableFacts } from '../engine/timesTable';
import type { FactId, Problem, SkillId } from '../engine/types';
// `save.ts` imports this module at runtime; a runtime import back would create a module cycle.
import type { SaveData } from '../storage/save';

/** The `kind` tag of a Learning Plan file. */
export const PLAN_KIND = 'number-wizard-learning-plan';

const SKILL = 'times-table';
const SKILLS: SkillId[] = ['times-table', 'multi-digit-multiplication', 'powers', 'long-division'];
const TABLE_IDS = new Set(timesTableFacts().map((f) => f.id));
const KEYS = ['kind', 'version', 'unlockedSkills', 'emphasize', 'thresholds', 'monsterHpScale', 'problems', 'note'];
const LIMITS = {
  thresholdMin: 1000, thresholdMax: 60000, tierThresholdMin: 5000, tierThresholdMax: 180000,
  scaleMin: 0.5, scaleMax: 3, problems: 50, operandMax: 12, note: 2000,
};

/** What the Guide imports: every field but `kind` and `version` is optional. It never contains story. */
export interface LearningPlan {
  kind: typeof PLAN_KIND;
  version: 1;
  unlockedSkills?: SkillId[];
  emphasize?: FactId[];
  thresholds?: Partial<Record<typeof SKILL | TierId, number>>;
  monsterHpScale?: number;
  problems?: [number, number][];
  note?: string;
}

/** A plan as the save holds it: explicit Problems are used up by Attempts made after `importedAt`. */
export interface StoredPlan {
  plan: LearningPlan;
  importedAt: string;
}

/** Throws the standard "Learning Plan: <field> <why>" validation error. */
const fail = (field: string, why: string): never => { throw new Error(`Learning Plan: ${field} ${why}`); };
/** Whether `n` is a finite number within `[min, max]`. */
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
    const keys: string[] = [SKILL, ...TIERS.map((tier) => tier.id)];
    if (typeof t !== 'object' || t === null || Array.isArray(t) || Object.keys(t).some((k) => !keys.includes(k))) {
      fail('thresholds', `may only set ${keys.map((k) => `"${k}"`).join(', ')}`);
    }
    plan.thresholds = {};
    for (const [key, ms] of Object.entries(t as Record<string, unknown>)) {
      const [min, max] = key === SKILL ? [LIMITS.thresholdMin, LIMITS.thresholdMax] : [LIMITS.tierThresholdMin, LIMITS.tierThresholdMax];
      if (!inRange(ms, min, max)) fail('thresholds', `${key} must be ${min} to ${max} ms`);
      plan.thresholds[key as typeof SKILL | TierId] = ms as number;
    }
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

/** A Fact's threshold with no plan in force: a Tier's own, or the table's 4000 ms. */
const defaultThresholdFor = (id: FactId): number => tierById(id)?.thresholdMs ?? TIMES_TABLE_THRESHOLD_MS;

/** The table speed threshold in force: the plan's, or 4000 ms. */
export const tableThresholdFor = (save: SaveData): number => save.learningPlan?.plan.thresholds?.[SKILL] ?? TIMES_TABLE_THRESHOLD_MS;

/** The speed threshold in force for a Fact: a Tier's own, or the table's. Drives Critical Hits, mastery, and Due dates. */
export const thresholdFor = (save: SaveData, id: FactId): number =>
  isTierId(id) ? save.learningPlan?.plan.thresholds?.[id] ?? defaultThresholdFor(id) : tableThresholdFor(save);

/** Achievements use the more lenient of the default and the plan, so a stricter plan never takes one away. */
export const achievementThresholdFor = (save: SaveData, id: FactId): number => Math.max(defaultThresholdFor(id), thresholdFor(save, id));

/** Monster HP under the plan's scale: rounded, never below 1. */
export const scaledHp = (save: SaveData, hp: number): number => Math.max(1, Math.round(hp * (save.learningPlan?.plan.monsterHpScale ?? 1)));

/** Whether the plan asks for extra weight on this Fact. */
export const isEmphasized = (save: SaveData, id: FactId): boolean => save.learningPlan?.plan.emphasize?.includes(id) ?? false;

/** The plan's explicit Problems not yet used up. An entry is used up by one Attempt on its Fact made after the import; the k-th repeat needs k. */
function pendingExplicit(save: SaveData): [number, number][] {
  const stored = save.learningPlan;
  if (!stored?.plan.problems) return [];
  const since = Date.parse(stored.importedAt);
  const budget: Record<FactId, number> = {};
  for (const a of save.attempts) if (Date.parse(a.at) > since) budget[a.factId] = (budget[a.factId] ?? 0) + 1;
  return stored.plan.problems.filter(([a, b]) => {
    const id = factId(a, b);
    if ((budget[id] ?? 0) > 0) { budget[id]!--; return false; }
    return true;
  });
}

/** How many explicit Problems the plan still has to serve. */
export const remainingExplicit = (save: SaveData): number => pendingExplicit(save).length;

/** The next explicit Problem, in the plan's operand order, skipping Facts already served this Encounter. */
export function nextExplicitProblem(save: SaveData, served: ReadonlySet<FactId>): Problem | null {
  const next = pendingExplicit(save).find(([a, b]) => !served.has(factId(a, b)));
  if (!next) return null;
  const [a, b] = next;
  return { factId: factId(a, b), skill: SKILL, prompt: `${a} × ${b}`, answer: a * b };
}
