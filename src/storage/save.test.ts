import { describe, expect, it } from 'vitest';
import { emptySave, memoryStore, migrate, withAttempt, withEncounter } from './save';
import { castSpell, startEncounter, type EncounterSpec, type SpellInput } from '../engine/combat';
import type { Attempt } from '../engine/types';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const LATER = new Date('2026-09-16T12:05:00.000Z');
const attempt: Attempt = {
  factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500,
  at: '2026-09-15T12:00:00.000Z', encounterId: 'e1', outcome: 'critical',
};
const spec: EncounterSpec = { id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 2 };
const spell = (over: Partial<SpellInput> = {}): SpellInput => ({
  factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 2000, ...over,
});

describe('save data', () => {
  it('starts empty for a Player', () => {
    expect(emptySave('noah')).toEqual({
      version: 2, playerId: 'noah', character: { xp: 0 }, attempts: [], encounters: [],
    });
  });

  it('appends an Attempt without mutating the original', () => {
    const before = emptySave('noah');
    const after = withAttempt(before, attempt);
    expect(after.attempts).toEqual([attempt]);
    expect(before.attempts).toEqual([]);
  });

  it('memoryStore round-trips and isolates its copy', async () => {
    const store = memoryStore();
    expect(await store.load()).toBeUndefined();
    const data = withAttempt(emptySave('noah'), attempt);
    await store.save(data);
    data.attempts.push(attempt);
    expect((await store.load())?.attempts).toHaveLength(1);
  });
});

describe('withEncounter', () => {
  it('records a won Encounter with its XP and Loot and adds the XP to the Character', () => {
    const won = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW); // Critical, 2 damage
    const data = withEncounter(emptySave('noah'), won, 'hat', LATER);
    expect(data.encounters).toEqual([{
      id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 2,
      startedAt: NOW.toISOString(), endedAt: LATER.toISOString(), status: 'won', xp: 4, loot: 'hat',
    }]);
    expect(data.character.xp).toBe(4);
  });

  it('keeps XP from a Retreat and records no Loot', () => {
    let e = startEncounter(spec, 1, NOW);
    e = castSpell(e, spell({ durationMs: 5000 }), 4000, NOW); // Hit, 1
    e = castSpell(e, spell({ correct: false }), 4000, NOW);
    const data = withEncounter({ ...emptySave('noah'), character: { xp: 10 } }, e, null, LATER);
    expect(data.encounters[0]).toMatchObject({ status: 'retreated', xp: 1, loot: null });
    expect(data.character.xp).toBe(11);
  });

  it('throws for an active Encounter', () => {
    expect(() => withEncounter(emptySave('noah'), startEncounter(spec, 5, NOW), null, LATER))
      .toThrow('Encounter e1 is still active');
  });
});

describe('migrate', () => {
  it('returns a version-2 save unchanged', () => {
    const data = emptySave('noah');
    expect(migrate(data)).toEqual(data);
  });

  it('upgrades a version-1 save: XP 0, no Encounters, every Attempt gets an outcome (invariant 6)', () => {
    const v1 = {
      version: 1, playerId: 'noah',
      attempts: [
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-15T12:00:00.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 5000, at: '2026-09-15T12:00:05.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 13, correct: false, durationMs: 1500, at: '2026-09-15T12:00:10.000Z', encounterId: 'e1' },
      ],
    };
    const data = migrate(v1);
    expect(data.version).toBe(2);
    expect(data.character).toEqual({ xp: 0 });
    expect(data.encounters).toEqual([]);
    expect(data.attempts.map((a) => a.outcome)).toEqual(['critical', 'hit', 'miss']);
    expect(data.attempts[0]).toMatchObject(v1.attempts[0]!);
  });

  it('throws on an unsupported version', () => {
    expect(() => migrate({ version: 3 })).toThrow('Unsupported save version: 3');
    expect(() => migrate(null)).toThrow('Unsupported save version: undefined');
  });
});
