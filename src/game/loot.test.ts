import { describe, expect, it } from 'vitest';
import { ownedLoot, rollLootFor } from './loot';
import { beginEncounter, cast, nextProblem } from './play';
import { survivalRoster } from './survival';
import { QUEST_1 } from '../content/quest1';
import { QUEST_2 } from '../content/quest2';
import type { EncounterTemplate } from '../content';
import { EncounterStatus } from '../engine/combat';
import { emptySave, withCharacter, type EncounterRecord, type SaveData } from '../storage/save';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const base = (): SaveData => withCharacter(emptySave('noah'), 'Noah', 'character-01');
const record = (id: string, status: EncounterRecord['status'], loot: string | null): EncounterRecord => ({
  id, questId: QUEST_1.id, monsterId: 'gob-nine', monsterMaxHp: 6, startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status, xp: 0, loot,
});
const withRecords = (...records: EncounterRecord[]): SaveData => ({ ...base(), encounters: records });
const POOL = QUEST_1.lootPool;

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

  it('gives unowned Loot in pool order, whatever the rng says, so a boss gives its first item first', () => {
    expect(rollLootFor(base(), ['star-hat', 'moon-hat'], () => 0.99)).toBe('star-hat');
    const owned = withRecords(record('a', EncounterStatus.Won, 'star-hat'));
    expect(rollLootFor(owned, ['star-hat', 'moon-hat'], () => 0.99)).toBe('moon-hat');
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

  it('each monster drops its own Loot; the boss a second time completes the set (invariant 1)', () => {
    for (const quest of [QUEST_1, QUEST_2]) {
      let seed = 7;
      const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      let save = base();
      quest.encounters.forEach((e, i) => {
        save = winOne(save, e, `${quest.id}-${i}`, rng);
        expect(save.encounters.at(-1)!.loot, e.monsterId).toBe(e.lootPool[0]);
      });
      expect(ownedLoot(save).size).toBe(7);
      const boss = quest.encounters.at(-1)!;
      save = winOne(save, boss, `${quest.id}-boss-again`, rng);
      expect(save.encounters.at(-1)!.loot).toBe(boss.lootPool[1]);
      expect([...ownedLoot(save)].sort()).toEqual([...quest.lootPool].sort());
    }
  });

  it('beating the same monster again never gives another monster\'s Loot', () => {
    let save = base();
    for (let i = 0; i < 8; i++) save = winOne(save, QUEST_1.encounters[0]!, `w${i}`, () => 0.5);
    expect([...ownedLoot(save)]).toEqual(['nine-eye-monocle']);
  });

  it('a Survival win never drops Loot (invariant 2)', () => {
    const save = winOne(base(), survivalRoster(QUEST_1)[0]!, 's1', () => 0.5);
    expect(save.encounters[0]!.loot).toBeNull();
    expect(ownedLoot(save).size).toBe(0);
  });
});
