import { describe, expect, it } from 'vitest';
import { findTemplate, LOOT, QUEST_1, QUEST_1_FIRST } from './quest1';

const sentences = (text: string) => text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;

describe('Quest 1 content', () => {
  it('has seven Encounters with HP climbing from 6 to 15', () => {
    const hp = QUEST_1.encounters.map((e) => e.monsterMaxHp);
    expect(hp).toEqual([6, 7, 8, 10, 11, 13, 15]);
    expect(QUEST_1.id).toBe('fortress-of-twelves');
    expect(QUEST_1.name).toBe('The Fortress of Twelves');
    expect(QUEST_1.background).toBe('castle-02');
  });

  it('names the monsters in order with unique slugs', () => {
    expect(QUEST_1.encounters.map((e) => e.monsterId)).toEqual([
      'gob-nine', 'fourmidable-knight', 'spinner-six', 'ate-bat', 'tenta-cool', 'odd-owl', 'twelve-headed-hydra',
    ]);
    expect(new Set(QUEST_1.encounters.map((e) => e.monsterId)).size).toBe(7);
    expect(QUEST_1.encounters[0]!.monsterName).toBe('Gob-nine');
    expect(QUEST_1.encounters[6]!.monsterName).toBe('Twelve-Headed Hydra');
  });

  it('keeps every Story Panel to at most two sentences', () => {
    for (const e of QUEST_1.encounters) expect(sentences(e.story.text), e.monsterId).toBeLessThanOrEqual(2);
    expect(sentences(QUEST_1.closing.text)).toBeLessThanOrEqual(2);
    for (const e of QUEST_1.encounters) expect(e.story.text.trim().length).toBeGreaterThan(0);
  });

  it('gives every Encounter the whole eight-item Loot pool', () => {
    expect(Object.keys(LOOT)).toHaveLength(8);
    expect(LOOT['star-hat']).toBe('Star Hat');
    expect(LOOT['owl-feather-quill']).toBe('Owl Feather Quill');
    for (const e of QUEST_1.encounters) {
      expect(e.lootPool).toEqual(Object.keys(LOOT));
      expect(e.questId).toBe(QUEST_1.id);
      expect(e.background).toBe(QUEST_1.background);
    }
  });

  it('resolves every template by quest and monster id, and nothing across quests (invariant 2)', () => {
    for (const e of QUEST_1.encounters) expect(findTemplate(QUEST_1.id, e.monsterId)).toBe(e);
    expect(findTemplate('another-quest', 'gob-nine')).toBeNull();
    expect(findTemplate(QUEST_1.id, 'no-such-monster')).toBeNull();
  });

  it('exposes the first Encounter for existing callers', () => {
    expect(QUEST_1_FIRST).toBe(QUEST_1.encounters[0]);
  });
});
