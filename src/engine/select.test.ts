import { describe, expect, it } from 'vitest';
import { buildPools, factWeight, pickFact } from './select';
import type { Attempt, Fact, FactId, FactStatus } from './types';

const T0 = Date.parse('2026-09-15T12:00:00.000Z');
const f = (id: string): Fact => ({ id, skill: 'times-table' });
const learning: FactStatus = { state: 'learning', streak: 0, dueAt: null };
const mastered = (dueOffsetMs: number): FactStatus => ({
  state: 'mastered', streak: 3, dueAt: new Date(T0 + dueOffsetMs).toISOString(),
});
const miss = (): Attempt => ({ factId: 'x', answer: 0, correct: false, durationMs: 1, at: '', encounterId: 'e' });
const hit = (): Attempt => ({ ...miss(), correct: true });

describe('buildPools', () => {
  it('splits Facts into Due, Learning (eligible only), and Mastered', () => {
    const facts = [f('due'), f('learn'), f('ineligible'), f('later'), f('new')];
    const status: Record<FactId, FactStatus> = {
      due: mastered(-1), learn: learning, ineligible: learning, later: mastered(+1),
    };
    const pools = buildPools(facts, status, (x) => x.id !== 'ineligible', new Date(T0));
    expect(pools.due.map((x) => x.id)).toEqual(['due']);
    expect(pools.learning.map((x) => x.id)).toEqual(['learn', 'new']);
    expect(pools.mastered.map((x) => x.id)).toEqual(['later']);
  });
});

describe('factWeight', () => {
  it('is 1 plus Misses in the last five Attempts, plus 2 when emphasized', () => {
    expect(factWeight([], false)).toBe(1);
    expect(factWeight([miss(), miss(), hit(), hit(), hit(), hit(), hit()], false)).toBe(1);
    expect(factWeight([hit(), miss(), miss(), hit(), hit()], false)).toBe(3);
    expect(factWeight([], true)).toBe(3);
  });
});

describe('pickFact', () => {
  const pools = { due: [f('d1')], learning: [f('l1'), f('l2')], mastered: [f('m1')] };
  const flat = () => 1;

  it('serves Due Facts first', () => {
    expect(pickFact(pools, flat, new Set(), () => 0.99)?.id).toBe('d1');
  });

  it('serves Learning Facts when nothing is Due, weighted', () => {
    const p = { ...pools, due: [] };
    const heavy = (x: Fact) => (x.id === 'l2' ? 100 : 1);
    expect(pickFact(p, heavy, new Set(), () => 0.5)?.id).toBe('l2');
  });

  it('serves a Mastered Fact one time in five', () => {
    const p = { ...pools, due: [] };
    expect(pickFact(p, flat, new Set(), () => 0.1)?.id).toBe('m1');
    expect(pickFact(p, flat, new Set(), () => 0.3)?.id).not.toBe('m1');
  });

  it('skips Facts already served this Encounter', () => {
    expect(pickFact(pools, flat, new Set(['d1']), () => 0.99)?.id).not.toBe('d1');
  });

  it('allows repeats only when everything has been served', () => {
    const served = new Set(['d1', 'l1', 'l2', 'm1']);
    expect(pickFact(pools, flat, served, () => 0.99)).not.toBeNull();
  });

  it('returns null with no Facts at all', () => {
    expect(pickFact({ due: [], learning: [], mastered: [] }, flat, new Set())).toBeNull();
  });
});
