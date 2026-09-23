import { describe, expect, it } from 'vitest';
import { MAP_BACKGROUND, REGIONS } from './map';
import { QUESTS } from './quest1';

describe('Map regions', () => {
  it('has four regions in Skill order, two with a Quest and two without', () => {
    expect(REGIONS.map((r) => [r.id, r.skill, r.questId])).toEqual([
      ['fortress', 'times-table', 'fortress-of-twelves'],
      ['foundry', 'multi-digit-multiplication', 'golem-foundry'],
      ['peak', 'powers', null],
      ['delta', 'long-division', null],
    ]);
    expect(REGIONS.map((r) => r.name)).toEqual(['The Fortress of Twelves', 'The Golem Foundry', 'The Storm Peak', 'The Long Delta']);
    expect(MAP_BACKGROUND).toBe('map-01');
  });

  it('every region with a Quest names one in QUESTS, and every Quest has exactly one region (invariant 1)', () => {
    const questIds = QUESTS.map((q) => q.id);
    for (const r of REGIONS) if (r.questId !== null) expect(questIds).toContain(r.questId);
    for (const id of questIds) expect(REGIONS.filter((r) => r.questId === id)).toHaveLength(1);
  });

  it('keeps every hotspot inside the image and clear of the others', () => {
    for (const r of REGIONS) {
      const { left, top, width, height } = r.hotspot;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100);
      expect(top + height).toBeLessThanOrEqual(100);
    }
    const overlaps = (a: typeof REGIONS[number], b: typeof REGIONS[number]) =>
      a.hotspot.left < b.hotspot.left + b.hotspot.width && b.hotspot.left < a.hotspot.left + a.hotspot.width
      && a.hotspot.top < b.hotspot.top + b.hotspot.height && b.hotspot.top < a.hotspot.top + a.hotspot.height;
    for (const a of REGIONS) for (const b of REGIONS) if (a !== b) expect(overlaps(a, b), `${a.id} and ${b.id}`).toBe(false);
  });
});
