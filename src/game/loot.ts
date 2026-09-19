import { EncounterStatus, rollLoot } from '../engine/combat';
import type { SaveData } from '../storage/save';

/** Every Loot id the Character has won; ownership is never stored, only derived from won records. */
export function ownedLoot(save: SaveData): Set<string> {
  return new Set(
    save.encounters.filter((r) => r.status === EncounterStatus.Won && r.loot !== null).map((r) => r.loot as string),
  );
}

/**
 * The Loot a win gives from a monster's pool: the first id not yet owned, in pool order, so a boss
 * gives its first item first. Once all are owned it rolls from the whole pool; null for an empty pool.
 */
export function rollLootFor(save: SaveData, pool: string[], rng: () => number = Math.random): string | null {
  const owned = ownedLoot(save);
  return pool.find((id) => !owned.has(id)) ?? rollLoot(pool, rng);
}
