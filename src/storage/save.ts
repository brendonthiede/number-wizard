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
    load: () => get<SaveData>(key),
    save: (data) => set(key, data),
  };
}
