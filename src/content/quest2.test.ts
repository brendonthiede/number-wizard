import { describe, expect, it } from 'vitest';
import { findTemplate, LOOT, QUEST_1, QUESTS, SURVIVAL_QUEST_ID } from './quest1';
import { LOOT_2, QUEST_2 } from './quest2';

const sentences = (text: string) => text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;

describe('Quest 2 content', () => {
  it('is The Golem Foundry: seven multi-digit Encounters with HP 4 to 8, opened by Quest 1', () => {
    expect(QUEST_2.id).toBe('golem-foundry');
    expect(QUEST_2.name).toBe('The Golem Foundry');
    expect(QUEST_2.background).toBe('foundry-01');
    expect(QUEST_2.skill).toBe('multi-digit-multiplication');
    expect(QUEST_2.requires).toBe(QUEST_1.id);
    expect(QUEST_2.encounters.map((e) => e.monsterMaxHp)).toEqual([4, 4, 5, 5, 6, 7, 8]);
    expect(QUEST_2.encounters.map((e) => e.monsterId)).toEqual([
      'splitter-critter', 'tens-hen', 'partial-parrot', 'zero-hero', 'hundred-pede', 'sum-o', 'grand-product',
    ]);
    expect(QUEST_2.encounters[6]!.monsterName).toBe('The Grand Product');
    for (const e of QUEST_2.encounters) {
      expect(e.skill).toBe('multi-digit-multiplication');
      expect(e.questId).toBe(QUEST_2.id);
      expect(e.background).toBe(QUEST_2.background);
    }
    expect(QUEST_2.lootPool).toEqual(Object.keys(LOOT_2));
    expect(Object.fromEntries(QUEST_2.encounters.map((e) => [e.monsterId, e.lootPool]))).toEqual({
      'splitter-critter': ['splitting-wand'],
      'tens-hen': ['tens-egg-timer'],
      'partial-parrot': ['brass-feather-pen'],
      'zero-hero': ['ring-of-zeros'],
      'hundred-pede': ['brick-boots'],
      'sum-o': ['foundry-apron'],
      'grand-product': ['golem-heart-lantern', 'gear-goggles'],
    });
    // Every item can be won, and from exactly one monster.
    const dropped = QUEST_2.encounters.flatMap((e) => e.lootPool);
    expect(dropped).toHaveLength(QUEST_2.lootPool.length);
    expect([...dropped].sort()).toEqual([...QUEST_2.lootPool].sort());
  });

  it('keeps every Story Panel to at most two sentences', () => {
    for (const e of QUEST_2.encounters) {
      expect(sentences(e.story.text), e.monsterId).toBeLessThanOrEqual(2);
      expect(e.story.text.trim().length).toBeGreaterThan(0);
    }
    expect(sentences(QUEST_2.closing.text)).toBeLessThanOrEqual(2);
  });

  it('adds eight Loot items that never collide with Quest 1, and leaves Quest 1 its own pool', () => {
    expect(Object.keys(LOOT_2)).toHaveLength(8);
    expect(LOOT_2['ring-of-zeros']).toBe('Ring of Zeros');
    expect(Object.keys(LOOT)).toHaveLength(16);
    expect(QUEST_1.lootPool).toHaveLength(8);
    expect(QUEST_1.lootPool.some((id) => id in LOOT_2)).toBe(false);
  });

  it('shares no monster id with Quest 1, so a Survival fight resolves to exactly one template', () => {
    const ids = QUESTS.flatMap((q) => q.encounters.map((e) => e.monsterId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(QUESTS).toEqual([QUEST_1, QUEST_2]);
    expect(QUEST_1.skill).toBe('times-table');
    expect(QUEST_1.requires).toBeNull();
    expect(findTemplate(QUEST_2.id, 'sum-o')).toBe(QUEST_2.encounters[5]);
    expect(findTemplate(QUEST_1.id, 'sum-o')).toBeNull();
    expect(findTemplate(SURVIVAL_QUEST_ID, 'gob-nine')!.skill).toBe('times-table');
  });
});
