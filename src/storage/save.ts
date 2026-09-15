import { get, set } from 'idb-keyval';
import type { Attempt } from '../engine/types';

export interface SaveData {
  version: 1;
  playerId: string;
  attempts: Attempt[];
}

export interface Store {
  load(): Promise<SaveData | undefined>;
  save(data: SaveData): Promise<void>;
}

// The only copy of the Player's history lives in this blob (ADR-0001); every schema change lands here as a version bump plus a step in migrate.
export function migrate(raw: unknown): SaveData {
  if (typeof raw === 'object' && raw !== null && (raw as { version?: unknown }).version === 1) return raw as SaveData;
  throw new Error(`Unsupported save version: ${String((raw as { version?: unknown })?.version)}`);
}

export const emptySave = (playerId: string): SaveData => ({ version: 1, playerId, attempts: [] });

export const withAttempt = (data: SaveData, attempt: Attempt): SaveData => ({
  ...data,
  attempts: [...data.attempts, attempt],
});

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
      const raw = await get<SaveData>(key);
      return raw === undefined ? undefined : migrate(raw);
    },
    save: (data) => set(key, data),
  };
}
