import { describe, expect, it } from 'vitest';
import { emptySave, memoryStore, migrate, withActiveEncounter, withAttempt, withEncounter } from './save';
import { castSpell, startEncounter, type EncounterSpec, type SpellInput } from '../engine/combat';
import type { Attempt } from '../engine/types';

const NOW = new Date('2026-09-16T12:00:00.000Z');
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
      version: 2, playerId: 'noah', character: { xp: 0 }, attempts: [], encounters: [], activeEncounter: null,
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
  it('records a won Encounter with its XP and Loot, endedAt from the last Spell, and adds the XP to the Character', () => {
    const won = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW); // Critical, 2 damage
    const data = withEncounter(emptySave('noah'), won, 'hat');
    expect(data.encounters).toEqual([{
      id: 'e1', questId: 'q1', monsterId: 'gob-nine', monsterMaxHp: 2,
      startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status: 'won', xp: 4, loot: 'hat',
    }]);
    expect(data.character.xp).toBe(4);
  });

  it('keeps XP from a Retreat but drops any Loot passed in (F1: Loot only records on a win)', () => {
    let e = startEncounter(spec, 1, NOW);
    e = castSpell(e, spell({ durationMs: 5000 }), 4000, NOW); // Hit, 1
    e = castSpell(e, spell({ correct: false }), 4000, NOW);
    const data = withEncounter({ ...emptySave('noah'), character: { xp: 10 } }, e, 'hat');
    expect(data.encounters[0]).toMatchObject({ status: 'retreated', xp: 1, loot: null });
    expect(data.character.xp).toBe(11);
  });

  it('throws for an active Encounter', () => {
    expect(() => withEncounter(emptySave('noah'), startEncounter(spec, 5, NOW), null))
      .toThrow('Encounter e1 is still active');
  });

  it('does not mutate the input data (F10)', () => {
    const won = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW);
    const before = emptySave('noah');
    withEncounter(before, won, 'hat');
    expect(before.encounters).toHaveLength(0);
    expect(before.character.xp).toBe(0);
  });

  it('clears activeEncounter once the Encounter is recorded (F2)', () => {
    const won = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW);
    const withActive = withActiveEncounter(emptySave('noah'), won);
    const data = withEncounter(withActive, won, 'hat');
    expect(data.activeEncounter).toBeNull();
  });
});

describe('withActiveEncounter', () => {
  it('stores the live Encounter as-is', () => {
    const e = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW);
    const data = withActiveEncounter(emptySave('noah'), e);
    expect(data.activeEncounter).toEqual(e);
  });
});

describe('invariant 7: every Attempt resolves to activeEncounter or an Encounter record', () => {
  it('holds after any sequence of withAttempt/withActiveEncounter/withEncounter', () => {
    const bigger = { ...spec, monsterMaxHp: 3 };
    let data = emptySave('noah');
    let e = startEncounter(bigger, 5, NOW);
    e = castSpell(e, spell({ durationMs: 5000 }), 4000, NOW); // Hit, 1 damage: still active
    data = withAttempt(data, e.spells[0]!);
    data = withActiveEncounter(data, e); // reload point: Encounter still active
    e = castSpell(e, spell(), 4000, NOW); // Critical, 2 more: won
    data = withAttempt(data, e.spells[1]!);
    data = withEncounter(data, e, null);

    const recordIds = new Set(data.encounters.map((r) => r.id));
    for (const a of data.attempts) {
      const resolves = a.encounterId === data.activeEncounter?.spec.id || recordIds.has(a.encounterId);
      expect(resolves).toBe(true);
    }
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

  it('throws on a corrupt version-2 save (F3)', () => {
    expect(() => migrate({ version: 2 })).toThrow('Corrupt save data (version 2)');
  });

  it('throws on a version-2 save whose XP is not finite', () => {
    for (const xp of [NaN, Infinity]) {
      expect(() => migrate({ ...emptySave('noah'), character: { xp } })).toThrow('Corrupt save data (version 2)');
    }
  });

  it('throws on a corrupt version-1 save (F3)', () => {
    expect(() => migrate({ version: 1, playerId: 'noah' })).toThrow('Corrupt save data (version 1)');
  });
});
