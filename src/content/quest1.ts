import type { EncounterTemplate } from './index';

/** One comic panel of story: at most two sentences, shown before a fight or after the boss. */
export interface StoryPanel {
  text: string;
}

/** An Encounter template plus the Story Panel that introduces it. */
export interface QuestEncounter extends EncounterTemplate {
  story: StoryPanel;
}

/** A hand-authored Quest: ordered Encounters, a shared Loot pool, and a closing panel. */
export interface Quest {
  id: string;
  name: string;
  background: string;
  lootPool: string[];
  encounters: QuestEncounter[];
  closing: StoryPanel;
}

/** Loot ids to display names. Cosmetic only; art and display come with the Loot plan. */
export const LOOT: Record<string, string> = {
  'star-hat': 'Star Hat',
  'moon-hat': 'Moon Hat',
  'nine-eye-monocle': 'Nine-Eye Monocle',
  'rusty-gauntlet': 'Rusty Gauntlet',
  'spider-silk-scarf': 'Spider-Silk Scarf',
  'bat-wing-cloak': 'Bat-Wing Cloak',
  'ink-staff': 'Ink Staff',
  'owl-feather-quill': 'Owl Feather Quill',
};

const QUEST_ID = 'fortress-of-twelves';
const BACKGROUND = 'castle-02';
const LOOT_POOL = Object.keys(LOOT);

const encounter = (monsterId: string, monsterName: string, monsterMaxHp: number, text: string): QuestEncounter => ({
  questId: QUEST_ID, monsterId, monsterName, monsterMaxHp, lootPool: LOOT_POOL, background: BACKGROUND, story: { text },
});

/** Quest 1: seven fights up the hill to the Twelve-Headed Hydra, HP 6 to 15. */
export const QUEST_1: Quest = {
  id: QUEST_ID,
  name: 'The Fortress of Twelves',
  background: BACKGROUND,
  lootPool: LOOT_POOL,
  encounters: [
    encounter('gob-nine', 'Gob-nine', 6, 'The Twelve-Headed Hydra smashed the Fortress of Twelves and scattered the Great Times Table. A goblin with nine eyes guards the first stone.'),
    encounter('fourmidable-knight', 'The Fourmidable Knight', 7, 'A rusty knight blocks the path with four arms and four swords. He has never lost a fight, mostly because nobody can count his hits.'),
    encounter('spinner-six', 'Spinner Six', 8, 'A giant spider drops from the gate with only six legs. Do not mention the missing two.'),
    encounter('ate-bat', 'The Ate-Bat', 10, 'In the courtyard a fat bat with eight wings is eating numbers off the wall. It burps a seven.'),
    encounter('tenta-cool', 'Tenta-Cool', 11, 'A ten-armed squid in sunglasses lounges in the moat. It offers to fight you with one arm tied behind its back.'),
    encounter('odd-owl', 'The Odd Owl', 13, 'High in the tower an owl hoots eleven times and glares at every even number. It has been waiting all night.'),
    encounter('twelve-headed-hydra', 'Twelve-Headed Hydra', 15, 'At the top, twelve heads argue about the answer to everything. They all turn to look at you at once.'),
  ],
  closing: { text: "The Great Times Table is whole again and the Fortress lights up window by window. The Hydra's heads agree on one thing: leave." },
};

/** The first Encounter of Quest 1, kept for callers that predate the Quest screen. */
export const QUEST_1_FIRST: QuestEncounter = QUEST_1.encounters[0]!;

const QUESTS: Quest[] = [QUEST_1];

/**
 * Quest id Survival fights are recorded under, so a run never advances Quest progress and the
 * Export can tell a Survival fight from a Quest fight. Defined here, not in `game/survival.ts`,
 * because `findTemplate` needs it too and `quest1.ts` must not import from `game/`.
 */
export const SURVIVAL_QUEST_ID = 'survival';

/**
 * Resolves a saved Encounter's template by quest and monster id; null when content no longer has
 * it. The Survival quest id searches every Quest's Encounters by monster id alone and returns the
 * match tagged with the Survival quest id and an empty Loot pool, since a Survival roster can draw
 * from any Quest and Loot is the Quest's reward, not Survival's.
 */
export function findTemplate(questId: string, monsterId: string): QuestEncounter | null {
  if (questId === SURVIVAL_QUEST_ID) {
    for (const q of QUESTS) {
      const match = q.encounters.find((e) => e.monsterId === monsterId);
      if (match) return { ...match, questId: SURVIVAL_QUEST_ID, lootPool: [] };
    }
    return null;
  }
  return QUESTS.find((q) => q.id === questId)?.encounters.find((e) => e.monsterId === monsterId) ?? null;
}
