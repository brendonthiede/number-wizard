import { describe, expect, it } from 'vitest';
import { ownedLoot, rollLootFor } from './loot';
import { beginEncounter, cast, nextProblem } from './play';
import { survivalRoster } from './survival';
import { LOOT, QUEST_1 } from '../content/quest1';
import type { EncounterTemplate } from '../content';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const record = (id: string, status: EncounterRecord['status'], loot: string | null): EncounterRecord => ({
  id, questId: QUEST_1.id, monsterId: 'gob-nine', monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status, xp: 0, loot,
});
const withRecords = (...records: EncounterRecord[]): SaveData => ({ ...base(), encounters: records });
const POOL = Object.keys(LOOT);

describe('ownedLoot', () => {
  it('is the set of Loot ids on won records, ignoring Retreats and repeats', () => {
    const save = withRecords(record('a', EncounterStatus.Won, 'star-hat'), record('b', EncounterStatus.Won, 'star-hat'), record('c', EncounterStatus.Retreated, null), record('d', EncounterStatus.Won, 'ink-staff'));
    expect([...ownedLoot(save)].sort()).toEqual(['ink-staff', 'star-hat']);
    expect(ownedLoot(base()).size).toBe(0);
  });
});

describe('rollLootFor', () => {
  it('prefers Loot not yet owned, then anything once all is owned, and nothing from an empty pool', () => {
    const owned = withRecords(record('a', EncounterStatus.Won, 'star-hat'));
    expect(rollLootFor(owned, ['star-hat', 'moon-hat'], () => 0)).toBe('moon-hat');
    const all = withRecords(record('a', EncounterStatus.Won, 'star-hat'), record('b', EncounterStatus.Won, 'moon-hat'));
    expect(rollLootFor(all, ['star-hat', 'moon-hat'], () => 0)).toBe('star-hat');
    expect(rollLootFor(base(), [], () => 0)).toBeNull();
  });

  it('never returns an owned id while an unowned one remains (invariant 3)', () => {
    let seed = 11;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let k = 0; k < 200; k++) {
      const ownedIds = POOL.filter(() => rng() < 0.5);
      if (ownedIds.length === POOL.length) continue;
      const save = withRecords(...ownedIds.map((id, i) => record(`r${i}`, EncounterStatus.Won, id)));
      const rolled = rollLootFor(save, POOL, rng)!;
      expect(ownedIds).not.toContain(rolled);
    }
  });
});

describe('drops through play.ts', () => {
  const winOne = (save: SaveData, template: EncounterTemplate, id: string, rng: () => number) => {
    let { save: s, encounter } = beginEncounter(save, template, NOW, id);
    while (encounter.status === EncounterStatus.Active) {
      const p = nextProblem(s, encounter, NOW, rng);
      ({ save: s, encounter } = cast(s, encounter, template, p, p.answer, 1000, NOW, rng));
    }
    return s;
  };

  it('eight Quest wins from an empty collection own all eight (invariant 1)', () => {
    for (const start of [1, 7, 42]) {
      let seed = start;
      const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      let save = base();
      for (let i = 0; i < 8; i++) save = winOne(save, QUEST_1.encounters[0]!, `w${i}`, rng);
      expect([...ownedLoot(save)].sort()).toEqual([...POOL].sort());
    }
  });

  it('a Survival win never drops Loot (invariant 2)', () => {
    const save = winOne(base(), survivalRoster(QUEST_1)[0]!, 's1', () => 0.5);
    expect(save.encounters[0]!.loot).toBeNull();
    expect(ownedLoot(save).size).toBe(0);
  });
});
