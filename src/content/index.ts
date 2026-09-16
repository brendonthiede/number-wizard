export const APP_TITLE = 'Number Wizard';

export interface EncounterTemplate {
  questId: string;
  monsterId: string;
  monsterName: string;
  monsterMaxHp: number;
  lootPool: string[];
}

export const PLAYER_ID = 'noah';

export const PORTRAITS = ['character-01', 'character-02', 'character-03'] as const;

export const QUEST_1_FIRST: EncounterTemplate = {
  questId: 'fortress-of-twelves',
  monsterId: 'gob-nine',
  monsterName: 'Gob-nine',
  monsterMaxHp: 6,
  lootPool: [],
};
