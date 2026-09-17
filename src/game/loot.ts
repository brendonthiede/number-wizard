import { EncounterStatus, rollLoot } from '../engine/combat';
import type { SaveData } from '../storage/save';

/** Every Loot id the Character has won; ownership is never stored, only derived from won records. */
export function ownedLoot(save: SaveData): Set<string> {
  return new Set(
    save.encounters.filter((r) => r.status === EncounterStatus.Won && r.loot !== null).map((r) => r.loot as string),
  );
}

/** Rolls from the pool's unowned ids while any remain, then from the whole pool; null for an empty pool. */
export function rollLootFor(save: SaveData, pool: string[], rng: () => number = Math.random): string | null {
  const owned = ownedLoot(save);
  const unowned = pool.filter((id) => !owned.has(id));
  return rollLoot(unowned.length ? unowned : pool, rng);
}
