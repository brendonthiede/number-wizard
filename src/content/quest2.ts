import { Skill } from '../engine/types';
// Types only: quest1.ts imports this module at runtime for the Quest registry.
import type { Quest, QuestEncounter } from './quest1';

/** Quest 2's Loot ids to display names. Merged into `LOOT` by quest1.ts. */
export const LOOT_2: Record<string, string> = {
  'gear-goggles': 'Gear Goggles',
  'brick-boots': 'Brick Boots',
  'ring-of-zeros': 'Ring of Zeros',
  'brass-feather-pen': 'Brass Feather Pen',
  'tens-egg-timer': 'Tens Egg Timer',
  'foundry-apron': 'Foundry Apron',
  'splitting-wand': 'Splitting Wand',
  'golem-heart-lantern': 'Golem-Heart Lantern',
};

const QUEST_ID = 'golem-foundry';
const BACKGROUND = 'foundry-01';
const LOOT_POOL = Object.keys(LOOT_2);

/** Builds one Quest 2 Encounter template, filling in the fields shared by every fight in this Quest. */
const encounter = (monsterId: string, monsterName: string, monsterMaxHp: number, text: string): QuestEncounter => ({
  questId: QUEST_ID, monsterId, monsterName, monsterMaxHp, lootPool: LOOT_POOL, background: BACKGROUND, skill: Skill.MultiDigit, story: { text },
});

/** Quest 2: seven fights through the foundry to The Grand Product. HP 4 to 8, lower than Quest 1 because a Work grid Spell takes longer. */
export const QUEST_2: Quest = {
  id: QUEST_ID,
  name: 'The Golem Foundry',
  background: BACKGROUND,
  lootPool: LOOT_POOL,
  skill: Skill.MultiDigit,
  requires: 'fortress-of-twelves',
  encounters: [
    encounter('splitter-critter', 'Splitter Critter', 4, 'Below the Fortress an old foundry has started up by itself, and it is building monsters out of numbers. The first one splits in two when it sees you: a tens half and a ones half.'),
    encounter('tens-hen', 'The Tens Hen', 4, 'A clockwork hen struts along the conveyor belt laying eggs in stacks of ten. She counts them before they hatch.'),
    encounter('partial-parrot', 'Partial Parrot', 5, 'A brass parrot repeats only part of everything you say. "Products!" it squawks.'),
    encounter('zero-hero', 'Zero the Hero', 5, 'A small golem in a cape juggles zeros and sticks them on the end of every number he meets. He thinks that makes him ten times braver.'),
    encounter('hundred-pede', 'The Hundred-Pede', 6, 'Something with a hundred iron feet is marching round the furnace in step. It takes a while to turn around.'),
    encounter('sum-o', 'Sum-o', 7, 'A huge round golem stamps the floor and bows. He adds up everything he has eaten today, and it is a lot.'),
    encounter('grand-product', 'The Grand Product', 8, 'At the heart of the foundry stand four great blocks stacked into one giant. Every block is a piece of the answer.'),
  ],
  closing: { text: 'The Grand Product comes apart into four tidy blocks and the furnace goes quiet. You knew how to take a big number to pieces, and how to put it back.' },
};
