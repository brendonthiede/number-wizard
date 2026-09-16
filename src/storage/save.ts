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
  if (version === 2) return raw as SaveData;
  if (version === 1) {
    const old = raw as SaveV1;
    // v1 only ever held times-table Attempts, which have no Work.
    const attempts = old.attempts.map((a) => ({
      ...a, outcome: resolveSpell({ ...a, workCorrect: true }, TIMES_TABLE_THRESHOLD_MS),
    }));
    return { version: 2, playerId: old.playerId, character: { xp: 0 }, attempts, encounters: [] };
  }
  throw new Error(`Unsupported save version: ${String(version)}`);
}

export const emptySave = (playerId: string): SaveData => ({
  version: 2, playerId, character: { xp: 0 }, attempts: [], encounters: [],
});

export const withAttempt = (data: SaveData, attempt: Attempt): SaveData => ({
  ...data,
  attempts: [...data.attempts, attempt],
});

export function withEncounter(data: SaveData, encounter: Encounter, loot: string | null, now: Date): SaveData {
  if (encounter.status === 'active') throw new Error(`Encounter ${encounter.spec.id} is still active`);
  const xp = encounterXp(encounter);
  const record: EncounterRecord = {
    ...encounter.spec, startedAt: encounter.startedAt, endedAt: now.toISOString(), status: encounter.status, xp, loot,
  };
  return { ...data, character: { xp: data.character.xp + xp }, encounters: [...data.encounters, record] };
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
