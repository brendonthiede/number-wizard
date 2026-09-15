import { isDue } from './mastery';
import type { Attempt, Fact, FactId, FactStatus } from './types';

export interface Pools<F extends Fact> {
  due: F[];
  learning: F[];
  mastered: F[];
}

const MASTERED_SHARE = 0.2; // one in five
const RECENT = 5;

export function buildPools<F extends Fact>(
  facts: F[],
  status: Record<FactId, FactStatus>,
  eligible: (f: F) => boolean,
  now: Date,
): Pools<F> {
  const pools: Pools<F> = { due: [], learning: [], mastered: [] };
  for (const f of facts) {
    const s = status[f.id];
    if (s?.state === 'mastered') (isDue(s, now) ? pools.due : pools.mastered).push(f);
    else if (eligible(f)) pools.learning.push(f);
  }
  return pools;
}

export function factWeight(attemptsForFact: Attempt[], emphasized: boolean): number {
  const misses = attemptsForFact.slice(-RECENT).filter((a) => !a.correct).length;
  return 1 + misses + (emphasized ? 2 : 0);
}

function weighted<F>(items: F[], weight: (f: F) => number, rng: () => number): F {
  const total = items.reduce((sum, f) => sum + weight(f), 0);
  let r = rng() * total;
  for (const f of items) {
    r -= weight(f);
    if (r < 0) return f;
  }
  return items[items.length - 1]!;
}

export function pickFact<F extends Fact>(
  pools: Pools<F>,
  weight: (f: F) => number,
  served: ReadonlySet<FactId>,
  rng: () => number = Math.random,
): F | null {
  const fresh = (fs: F[]) => fs.filter((f) => !served.has(f.id));
  const due = fresh(pools.due);
  if (due.length) return weighted(due, weight, rng);
  const learning = fresh(pools.learning);
  const mastered = fresh(pools.mastered);
  if (mastered.length && (!learning.length || rng() < MASTERED_SHARE)) return weighted(mastered, weight, rng);
  if (learning.length) return weighted(learning, weight, rng);
  const all = [...pools.due, ...pools.learning, ...pools.mastered]; // everything served: repeats allowed
  return all.length ? weighted(all, weight, rng) : null;
}
