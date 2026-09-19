import { describe, expect, it } from 'vitest';
import { PORTRAITS } from './index';
import { findTemplate, LOOT, QUEST_1, QUEST_1_FIRST, SURVIVAL_QUEST_ID, type Quest } from './quest1';
import { QUEST_2 } from './quest2';

const sentences = (text: string) => text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0).length;

describe('Quest 1 content', () => {
  it('has seven Encounters with HP climbing from 6 to 15', () => {
    const hp = QUEST_1.encounters.map((e) => e.monsterMaxHp);
    expect(hp).toEqual([6, 7, 8, 10, 11, 13, 15]);
    expect(QUEST_1.id).toBe('fortress-of-twelves');
    expect(QUEST_1.name).toBe('The Fortress of Twelves');
    expect(QUEST_1.background).toBe('castle-02');
  });

  it('never shares its id with the Survival quest id', () => {
    expect(QUEST_1.id).not.toBe(SURVIVAL_QUEST_ID);
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
    expect(Object.keys(LOOT)).toHaveLength(16);
    expect(LOOT['star-hat']).toBe('Star Hat');
    expect(LOOT['owl-feather-quill']).toBe('Owl Feather Quill');
    expect(QUEST_1.lootPool).toEqual([
      'star-hat', 'moon-hat', 'nine-eye-monocle', 'rusty-gauntlet', 'spider-silk-scarf', 'bat-wing-cloak', 'ink-staff', 'owl-feather-quill',
    ]);
    for (const e of QUEST_1.encounters) {
      expect(e.lootPool).toEqual(QUEST_1.lootPool);
      expect(e.questId).toBe(QUEST_1.id);
      expect(e.background).toBe(QUEST_1.background);
    }
  });

  it('resolves every template by quest and monster id, and nothing across quests (invariant 2)', () => {
    for (const e of QUEST_1.encounters) expect(findTemplate(QUEST_1.id, e.monsterId)).toBe(e);
    expect(findTemplate('another-quest', 'gob-nine')).toBeNull();
    expect(findTemplate(QUEST_1.id, 'no-such-monster')).toBeNull();
  });

  it('resolves a Survival fight by monster id alone, tagged with the Survival quest id', () => {
    const odd = findTemplate(SURVIVAL_QUEST_ID, 'odd-owl');
    expect(odd).toMatchObject({ monsterId: 'odd-owl', monsterName: 'The Odd Owl', questId: SURVIVAL_QUEST_ID });
    expect(findTemplate(SURVIVAL_QUEST_ID, 'nobody')).toBeNull();
  });

  it('resolves a resumed Survival fight with no Loot: Loot is the Quest\'s reward (F2)', () => {
    expect(findTemplate(SURVIVAL_QUEST_ID, 'odd-owl')!.lootPool).toEqual([]);
  });

  it('exposes the first Encounter for existing callers', () => {
    expect(QUEST_1_FIRST).toBe(QUEST_1.encounters[0]);
  });

  it('ships every piece of art as a WebP with a PNG master in art-src, and no PNG in public/art', () => {
    // Lazy globs: only the keys are read, so nothing is loaded. The size budget lives in scripts/shrink.py.
    const shipped = Object.keys(import.meta.glob('/public/art/**/*'));
    const masters = Object.keys(import.meta.glob('/art-src/**/*.png'));
    const questSlugs = (q: Quest) => [
      `background/${q.background}`,
      ...q.encounters.map((e) => `monster/${e.monsterId}`),
      ...q.lootPool.map((id) => `loot/${id}`),
    ];
    const required = [...questSlugs(QUEST_1), ...PORTRAITS.map((p) => `character/${p}`)];
    // Quest 2 art arrives after the code: a slug is required as soon as its master is committed.
    const arrived = questSlugs(QUEST_2).filter((f) => masters.includes(`/art-src/${f}.png`));
    expect(shipped.sort()).toEqual([...required, ...arrived].map((f) => `/public/art/${f}.webp`).sort());
    for (const f of required) expect(masters, f).toContain(`/art-src/${f}.png`);
  });
});
