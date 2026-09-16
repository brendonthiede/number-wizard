import { describe, expect, it } from 'vitest';
import { statusByFact, TIMES_TABLE_THRESHOLD_MS } from './mastery';
import { buildPools, factWeight, pickFact } from './select';
import { inRows, introducedRows } from './rows';
import { timesTableFacts } from './timesTable';
import { castSpell, rollLoot, servedFacts, startEncounter, type EncounterSpec } from './combat';
import { levelForXp, maxHpForLevel } from './character';
import { emptySave, withActiveEncounter, withAttempt, withEncounter, type SaveData } from '../storage/save';

let seed = 99;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const facts = timesTableFacts();
const LOOT = ['hat', 'staff', 'cloak'];

function playEncounter(save: SaveData, i: number, now: Date) {
  const status = statusByFact(save.attempts, TIMES_TABLE_THRESHOLD_MS);
  const rows = introducedRows(status);
  const pools = buildPools(facts, status, (f) => inRows(f, rows), now);
  const maxHp = maxHpForLevel(levelForXp(save.character.xp));
  const spec: EncounterSpec = { id: `e${i}`, questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 6 };
  let e = startEncounter(spec, maxHp, now);
  const byFact: Record<string, Parameters<typeof factWeight>[0]> = {};
  for (const a of save.attempts) (byFact[a.factId] ??= []).push(a);
  while (e.status === 'active') {
    const fact = pickFact(pools, (f) => factWeight(byFact[f.id] ?? [], false), servedFacts(e), rng);
    expect(fact).not.toBeNull(); // pickFact never starves inside an Encounter
    const correct = rng() < 0.8;
    const durationMs = rng() < 0.8 ? 1500 : 6000;
    e = castSpell(e, { factId: fact!.id, answer: correct ? 1 : 0, correct, workCorrect: true, durationMs }, TIMES_TABLE_THRESHOLD_MS, now);
    save = withAttempt(save, e.spells[e.spells.length - 1]!);
    save = withActiveEncounter(save, e); // UI persists the live Encounter after every Spell (F2)
  }
  const loot = e.status === 'won' ? rollLoot(LOOT, rng) : null;
  return { save: withEncounter(save, e, loot), maxHp };
}

describe('play loop across many Encounters', () => {
  it('never orphans an Attempt, starves a Spell, or loses XP', () => {
    let save = emptySave('noah');
    let t = Date.parse('2026-09-16T12:00:00.000Z');
    for (let i = 0; i < 150; i++) {
      t += 43_200_000; // two Encounters a day
      const level = levelForXp(save.character.xp);
      const { save: after, maxHp } = playEncounter(save, i, new Date(t));
      save = after;
      expect(save.activeEncounter).toBeNull();
      expect(maxHp).toBe(maxHpForLevel(level));
    }
    expect(save.character.xp).toBe(save.encounters.reduce((sum, r) => sum + r.xp, 0));
    const recordIds = new Set(save.encounters.map((r) => r.id));
    for (const a of save.attempts) {
      expect(a.encounterId === save.activeEncounter?.spec.id || recordIds.has(a.encounterId)).toBe(true);
    }
  });
});
