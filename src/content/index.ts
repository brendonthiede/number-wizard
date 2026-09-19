import type { SkillId } from '../engine/types';

export const APP_TITLE = 'Number Wizard';

export interface EncounterTemplate {
  questId: string;
  monsterId: string;
  monsterName: string;
  monsterMaxHp: number;
  lootPool: string[];
  background: string;
  skill: SkillId;
}

export const PLAYER_ID = 'noah';

export const PORTRAITS = ['character-01', 'character-02', 'character-03'] as const;

export { QUEST_1_FIRST } from './quest1';
