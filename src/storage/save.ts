import { get, set } from 'idb-keyval';
import { encounterXp } from '../engine/character';
import { resolveSpell, type Encounter } from '../engine/combat';
import { TIMES_TABLE_THRESHOLD_MS } from '../engine/mastery';
import type { Attempt } from '../engine/types';

export interface EncounterRecord {
  id: string;
  questId: string;
  monsterId: string;
  monsterMaxHp: number;
  startedAt: string;
  endedAt: string;
  status: 'won' | 'retreated';
  xp: number;
  loot: string | null;
}

export interface SaveData {
  version: 2;
  playerId: string;
  character: { xp: number };
  attempts: Attempt[];
  encounters: EncounterRecord[];
  activeEncounter: Encounter | null;
}

interface SaveV1 {
  version: 1;
  playerId: string;
  attempts: Omit<Attempt, 'outcome'>[];
}

export interface Store {
  load(): Promise<SaveData | undefined>;
  save(data: SaveData): Promise<void>;
}

// The only copy of the Player's history lives in this blob (ADR-0001); every schema change lands here as a version bump plus a step in migrate.
export function migrate(raw: unknown): SaveData {
  const version = (raw as { version?: unknown } | null)?.version;
  if (version === 2) {
    const data = raw as Partial<SaveData>;
    const valid = Array.isArray(data.attempts) && Array.isArray(data.encounters)
      && typeof data.character?.xp === 'number' && typeof data.activeEncounter === 'object';
    if (!valid) throw new Error(`Corrupt save data (version 2)`);
    return raw as SaveData;
  }
  if (version === 1) {
    const old = raw as Partial<SaveV1>;
    if (!Array.isArray(old.attempts)) throw new Error(`Corrupt save data (version 1)`);
    // v1 only ever held times-table Attempts, which have no Work.
    const attempts = old.attempts.map((a) => ({
      ...a, outcome: resolveSpell({ ...a, workCorrect: true }, TIMES_TABLE_THRESHOLD_MS),
    }));
    return { version: 2, playerId: old.playerId!, character: { xp: 0 }, attempts, encounters: [], activeEncounter: null };
  }
  throw new Error(`Unsupported save version: ${String(version)}`);
}

export const emptySave = (playerId: string): SaveData => ({
  version: 2, playerId, character: { xp: 0 }, attempts: [], encounters: [], activeEncounter: null,
});

export const withAttempt = (data: SaveData, attempt: Attempt): SaveData => ({
  ...data,
  attempts: [...data.attempts, attempt],
});

// The live Encounter is persisted after every Spell so a reload resumes it; nothing is ever lost.
export const withActiveEncounter = (data: SaveData, encounter: Encounter): SaveData => ({
  ...data,
  activeEncounter: encounter,
});

export function withEncounter(data: SaveData, encounter: Encounter, loot: string | null): SaveData {
  if (encounter.status === 'active') throw new Error(`Encounter ${encounter.spec.id} is still active`);
  const xp = encounterXp(encounter);
  // A finished Encounter always has at least one Spell; its `at` is the true end, not call time.
  const endedAt = encounter.spells[encounter.spells.length - 1]!.at;
  const record: EncounterRecord = {
    id: encounter.spec.id, questId: encounter.spec.questId, monsterId: encounter.spec.monsterId,
    monsterMaxHp: encounter.spec.monsterMaxHp, startedAt: encounter.startedAt, endedAt,
    status: encounter.status, xp, loot: encounter.status === 'won' ? loot : null,
  };
  return {
    ...data, character: { xp: data.character.xp + xp }, encounters: [...data.encounters, record], activeEncounter: null,
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
