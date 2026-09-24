import { Skill, type SkillId } from '../engine/types';

/** One region of the Map. A region with no Quest yet is always Fogged. */
export interface Region {
  id: string;
  name: string;
  skill: SkillId;
  questId: string | null;
  // Percent of the map image, so the art can be regenerated without a code change.
  hotspot: { left: number; top: number; width: number; height: number };
}

/** The map image's slug under `background/`. */
export const MAP_BACKGROUND = 'map-01';

/** The four regions in Skill order. Quest ids are literals: this module must not import a Quest at runtime. */
export const REGIONS: Region[] = [
  { id: 'fortress', name: 'The Fortress of Twelves', skill: Skill.TimesTable, questId: 'fortress-of-twelves', hotspot: { left: 3, top: 43, width: 40, height: 50 } },
  { id: 'foundry', name: 'The Golem Foundry', skill: Skill.MultiDigit, questId: 'golem-foundry', hotspot: { left: 54, top: 54, width: 44, height: 45 } },
  { id: 'peak', name: 'The Storm Peak', skill: Skill.Powers, questId: null, hotspot: { left: 61, top: 2, width: 38, height: 46 } },
  { id: 'delta', name: 'The Long Delta', skill: Skill.LongDivision, questId: null, hotspot: { left: 6, top: 3, width: 40, height: 35 } },
];
