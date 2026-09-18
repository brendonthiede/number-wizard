import { get, set } from 'idb-keyval';
import { encounterXp } from '../engine/character';
import { EncounterStatus, resolveSpell, type Encounter } from '../engine/combat';
import { TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import { PORTRAITS } from '../content';
import { parseLearningPlan, type LearningPlan, type StoredPlan } from '../game/learningPlan';
import { Outcome, type Attempt } from '../engine/types';

export interface EncounterRecord {
  id: string;
  questId: string;
  monsterId: string;
  monsterMaxHp: number;
  startedAt: string;
  endedAt: string;
  status: typeof EncounterStatus.Won | typeof EncounterStatus.Retreated;
  xp: number;
  loot: string | null;
}

export interface SaveData {
  version: 5;
  playerId: string;
  character: { name: string; portrait: string; xp: number; survivalBest: number };
  attempts: Attempt[];
  encounters: EncounterRecord[];
  activeEncounter: Encounter | null;
  learningPlan: StoredPlan | null;
}

interface SaveV1 {
  version: 1;
  playerId: string;
  attempts: Omit<Attempt, 'outcome'>[];
}

interface SaveV2 extends Omit<SaveData, 'version' | 'character' | 'learningPlan'> {
  version: 2;
  character: { xp: number };
}

interface SaveV3 extends Omit<SaveData, 'version' | 'character' | 'learningPlan'> {
  version: 3;
  character: { name: string; portrait: string; xp: number };
}

interface SaveV4 extends Omit<SaveData, 'version' | 'learningPlan'> {
  version: 4;
}

export interface Store {
  load(): Promise<SaveData | undefined>;
  save(data: SaveData): Promise<void>;
}

// Every field the Encounter screen reads on Continue; a near-valid blob must fail here, not mid-fight.
function isEncounter(value: unknown): value is Encounter {
  const e = value as Partial<Encounter> | null;
  const spec = e?.spec as Partial<Encounter['spec']> | undefined;
  return typeof e === 'object' && e !== null
    && typeof spec?.id === 'string' && typeof spec.questId === 'string' && typeof spec.monsterId === 'string'
    && Number.isFinite(spec.monsterMaxHp)
    && Number.isFinite(e.monsterHp) && Number.isFinite(e.characterHp) && Number.isFinite(e.characterMaxHp)
    && Array.isArray(e.spells) && e.spells.every(isAttempt) && typeof e.startedAt === 'string'
    && Object.values(EncounterStatus).includes(e.status as EncounterStatus);
}

// An Export is a paste-in trust boundary (ADR-0001): every field Mastery, Achievements, and the
// Encounter screen read must be checked here, not discovered mid-game.
function isAttempt(value: unknown): value is Attempt {
  const a = value as Partial<Attempt> | null;
  return typeof a === 'object' && a !== null
    && typeof a.factId === 'string' && typeof a.encounterId === 'string'
    && typeof a.at === 'string' && !Number.isNaN(Date.parse(a.at))
    && Number.isFinite(a.durationMs) && typeof a.correct === 'boolean'
    && (a.answer === null || Number.isFinite(a.answer))
    && Object.values(Outcome).includes(a.outcome as Outcome);
}

function isEncounterRecord(value: unknown): value is EncounterRecord {
  const r = value as Partial<EncounterRecord> | null;
  return typeof r === 'object' && r !== null
    && typeof r.id === 'string' && typeof r.questId === 'string' && typeof r.monsterId === 'string'
    && Number.isFinite(r.monsterMaxHp) && Number.isFinite(r.xp)
    && typeof r.startedAt === 'string' && !Number.isNaN(Date.parse(r.startedAt))
    && typeof r.endedAt === 'string' && !Number.isNaN(Date.parse(r.endedAt))
    && (r.status === EncounterStatus.Won || r.status === EncounterStatus.Retreated)
    && (r.loot === null || typeof r.loot === 'string');
}

// A stored plan passes the same parser as an imported one; anything else is a corrupt save.
function isStoredPlan(value: unknown): value is StoredPlan {
  const s = value as Partial<StoredPlan> | null;
  if (typeof s !== 'object' || s === null || typeof s.importedAt !== 'string' || Number.isNaN(Date.parse(s.importedAt))) return false;
  try { parseLearningPlan(s.plan); return true; } catch { return false; }
}

/**
 * Validates a current save or upgrades a version 1-4 save to the current schema, one version per
 * step. This blob is the only copy of the Player's history (ADR-0001): every schema change is a
 * version bump plus a step here, and a corrupt blob is rejected, never repaired in place.
 *
 * @throws {Error} When the version is unsupported or the save is corrupt.
 */
export function migrate(raw: unknown): SaveData {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 5) {
    const data = raw as Partial<SaveData>;
    const valid = Array.isArray(data.attempts) && data.attempts.every(isAttempt)
      && Array.isArray(data.encounters) && data.encounters.every(isEncounterRecord)
      && typeof data.character?.name === 'string' && typeof data.character.portrait === 'string'
      && Number.isFinite(data.character.xp) && Number.isFinite(data.character.survivalBest)
      && (data.activeEncounter === null || isEncounter(data.activeEncounter))
      && (data.learningPlan === null || isStoredPlan(data.learningPlan));
    if (!valid) throw new Error('Corrupt save data (version 5)');
    return raw as SaveData;
  }
  if (version === 4) {
    const old = raw as Partial<SaveV4>;
    const valid = Array.isArray(old.attempts) && Array.isArray(old.encounters)
      && typeof old.character?.name === 'string' && typeof old.character.portrait === 'string'
      && Number.isFinite(old.character.xp) && Number.isFinite(old.character.survivalBest)
      && (old.activeEncounter === null || isEncounter(old.activeEncounter));
    if (!valid) throw new Error('Corrupt save data (version 4)');
    return migrate({ ...old, version: 5, learningPlan: null });
  }
  if (version === 3) {
    const old = raw as Partial<SaveV3>;
    const valid = Array.isArray(old.attempts) && Array.isArray(old.encounters)
      && typeof old.character?.name === 'string' && typeof old.character.portrait === 'string'
      && Number.isFinite(old.character.xp)
      && (old.activeEncounter === null || isEncounter(old.activeEncounter));
    if (!valid) throw new Error('Corrupt save data (version 3)');
    return migrate({ ...old, version: 4, character: { ...old.character!, survivalBest: 0 } });
  }
  if (version === 2) {
    const old = raw as Partial<SaveV2>;
    const valid = Array.isArray(old.attempts) && Array.isArray(old.encounters)
      && Number.isFinite(old.character?.xp) && typeof old.activeEncounter === 'object';
    if (!valid) throw new Error('Corrupt save data (version 2)');
    return migrate({ ...old, version: 3, character: { name: '', portrait: PORTRAITS[0], xp: old.character!.xp } });
  }
  if (version === 1) {
    const old = raw as Partial<SaveV1>;
    if (!Array.isArray(old.attempts)) throw new Error('Corrupt save data (version 1)');
    // v1 only ever held times-table Attempts, which have no Work.
    const attempts = old.attempts.map((a) => ({
      ...a, outcome: resolveSpell({ ...a, workCorrect: true }, TIMES_TABLE_THRESHOLD_MS),
    }));
    return migrate({ version: 2, playerId: old.playerId!, character: { xp: 0 }, attempts, encounters: [], activeEncounter: null });
  }
  throw new Error(`Unsupported save version: ${String(version)}`);
}

/** Creates an empty current-version save for a Player without a configured Character. */
export const emptySave = (playerId: string): SaveData => ({
  version: 5, playerId, character: { name: '', portrait: PORTRAITS[0], xp: 0, survivalBest: 0 },
  attempts: [], encounters: [], activeEncounter: null, learningPlan: null,
});

export const withAttempt = (data: SaveData, attempt: Attempt): SaveData => ({
  ...data,
  attempts: [...data.attempts, attempt],
});

/** Stores an imported Learning Plan; explicit Problems count as used up only by Attempts after `now`. */
export const withLearningPlan = (data: SaveData, plan: LearningPlan, now: Date): SaveData => ({
  ...data,
  learningPlan: { plan, importedAt: now.toISOString() },
});

/** Removes the Learning Plan, returning every rule to its default. */
export const withoutLearningPlan = (data: SaveData): SaveData => ({ ...data, learningPlan: null });

export const withCharacter = (data: SaveData, name: string, portrait: string): SaveData => ({
  ...data,
  character: { ...data.character, name, portrait },
});

/** Raises the saved Survival best when `wins` exceeds it; otherwise returns the original save. */
export const withSurvivalBest = (data: SaveData, wins: number): SaveData =>
  wins > data.character.survivalBest ? { ...data, character: { ...data.character, survivalBest: wins } } : data;

// The live Encounter is persisted after every Spell so a reload resumes it; nothing is ever lost.
export const withActiveEncounter = (data: SaveData, encounter: Encounter): SaveData => ({
  ...data,
  activeEncounter: encounter,
});

export function withEncounter(data: SaveData, encounter: Encounter, loot: string | null): SaveData {
  if (encounter.status === EncounterStatus.Active) throw new Error(`Encounter ${encounter.spec.id} is still active`);
  const xp = encounterXp(encounter);
  // A finished Encounter always has at least one Spell; its `at` is the true end, not call time.
  const endedAt = encounter.spells[encounter.spells.length - 1]!.at;
  const record: EncounterRecord = {
    id: encounter.spec.id, questId: encounter.spec.questId, monsterId: encounter.spec.monsterId,
    monsterMaxHp: encounter.spec.monsterMaxHp, startedAt: encounter.startedAt, endedAt,
    status: encounter.status, xp, loot: encounter.status === EncounterStatus.Won ? loot : null,
  };
  return {
    ...data, character: { ...data.character, xp: data.character.xp + xp }, encounters: [...data.encounters, record], activeEncounter: null,
  };
}

export function memoryStore(): Store {
  let held: SaveData | undefined;
  return {
    load: async () => (held ? structuredClone(held) : undefined),
    save: async (data) => {
      held = structuredClone(data);
    },
  };
}

// Browser store: one blob in IndexedDB (ADR-0001). Untested glue; keep it this thin.
export function idbStore(key = 'number-wizard'): Store {
  return {
    load: async () => {
      const raw = await get<unknown>(key);
      return raw === undefined ? undefined : migrate(raw);
    },
    save: (data) => set(key, data),
  };
}
