import { describe, expect, it } from 'vitest';
import { emptySave, memoryStore, migrate, withActiveEncounter, withAttempt, withCharacter, withEncounter, withWorkLabelsHidden, withLearningPlan, withoutLearningPlan, withSurvivalBest } from './save';
import { castSpell, EncounterStatus, startEncounter, type EncounterSpec, type SpellInput } from '../engine/combat';
import { beginEncounter, cast, nextProblem } from '../game/play';
import { QUEST_1 } from '../content/quest1';
import { PLAN_KIND, type LearningPlan } from '../game/learningPlan';
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
      version: 6, playerId: 'noah', character: { name: '', portrait: 'character-01', xp: 0, survivalBest: 0 },
      attempts: [], encounters: [], activeEncounter: null, learningPlan: null, settings: { hideWorkLabels: false },
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

  it('withCharacter sets the name and portrait and keeps XP', () => {
    const data = withCharacter({ ...emptySave('noah'), character: { name: '', portrait: 'character-01', xp: 7, survivalBest: 0 } }, 'Noah', 'character-03');
    expect(data.character).toEqual({ name: 'Noah', portrait: 'character-03', xp: 7, survivalBest: 0 });
  });

  it('stores a Learning Plan with its import time, and removes it', () => {
    const plan: LearningPlan = { kind: PLAN_KIND, version: 1, note: 'hi' };
    const data = withLearningPlan(emptySave('noah'), plan, NOW);
    expect(data.learningPlan).toEqual({ plan, importedAt: NOW.toISOString() });
    expect(withoutLearningPlan(data).learningPlan).toBeNull();
    expect(emptySave('noah').learningPlan).toBeNull();
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
    const data = withEncounter({ ...emptySave('noah'), character: { ...emptySave('noah').character, xp: 10 } }, e, 'hat');
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
  it('returns a version-6 save unchanged', () => {
    const data = emptySave('noah');
    expect(migrate(data)).toEqual(data);
  });

  it('upgrades a version-4 save with a null Learning Plan (invariant 8)', () => {
    const { learningPlan: _none, ...rest } = emptySave('noah');
    const v4 = { ...rest, version: 4 };
    expect(migrate(v4)).toEqual(emptySave('noah'));
  });

  it('rejects a save whose stored Learning Plan is malformed (invariant 8)', () => {
    const good = withLearningPlan(emptySave('noah'), { kind: PLAN_KIND, version: 1, monsterHpScale: 2 }, NOW);
    expect(migrate(good)).toEqual(good);
    expect(() => migrate({ ...good, learningPlan: { plan: { kind: PLAN_KIND, version: 1, monsterHpScale: 9 }, importedAt: NOW.toISOString() } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...good, learningPlan: { plan: good.learningPlan!.plan } })).toThrow('Corrupt save data (version 6)');
  });

  it('upgrades a version-3 save: survival best starts at 0, everything else kept', () => {
    const v3 = { version: 3, playerId: 'noah', character: { name: 'Noah', portrait: 'character-02', xp: 25 }, attempts: [], encounters: [], activeEncounter: null };
    expect(migrate(v3)).toEqual({ ...v3, version: 6, character: { ...v3.character, survivalBest: 0 }, learningPlan: null, settings: { hideWorkLabels: false } });
  });

  it('upgrades a version-2 save all the way: empty name, first portrait, XP kept (invariant 3)', () => {
    const v2 = { version: 2, playerId: 'noah', character: { xp: 25 }, attempts: [], encounters: [], activeEncounter: null };
    expect(migrate(v2)).toEqual({ ...v2, version: 6, character: { name: '', portrait: 'character-01', xp: 25, survivalBest: 0 }, learningPlan: null, settings: { hideWorkLabels: false } });
  });

  it('withSurvivalBest raises the best only when beaten', () => {
    const data = { ...emptySave('noah'), character: { ...emptySave('noah').character, survivalBest: 3 } };
    expect(withSurvivalBest(data, 2).character.survivalBest).toBe(3);
    expect(withSurvivalBest(data, 5).character.survivalBest).toBe(5);
    expect(data.character.survivalBest).toBe(3);
  });

  it('upgrades a version-1 save all the way: XP 0, no Encounters, every Attempt gets an outcome', () => {
    const v1 = {
      version: 1, playerId: 'noah',
      attempts: [
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 1500, at: '2026-09-15T12:00:00.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 12, correct: true, durationMs: 5000, at: '2026-09-15T12:00:05.000Z', encounterId: 'e1' },
        { factId: 'tt:3x4', answer: 13, correct: false, durationMs: 1500, at: '2026-09-15T12:00:10.000Z', encounterId: 'e1' },
      ],
    };
    const data = migrate(v1);
    expect(data.version).toBe(6);
    expect(data.character).toEqual({ name: '', portrait: 'character-01', xp: 0, survivalBest: 0 });
    expect(data.encounters).toEqual([]);
    expect(data.activeEncounter).toBeNull();
    expect(data.learningPlan).toBeNull();
    expect(data.attempts.map((a) => a.outcome)).toEqual(['critical', 'hit', 'miss']);
    expect(data.attempts[0]).toMatchObject(v1.attempts[0]!);
  });

  it('rejects a save with no Player id', () => {
    const { playerId: _none, ...rest } = emptySave('noah');
    expect(() => migrate(rest)).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), playerId: 7 })).toThrow('Corrupt save data (version 6)');
  });

  it('still loads a save holding a negative duration: a device clock stepping back must not lock the Player out', () => {
    const data = withAttempt(emptySave('noah'), { ...attempt, durationMs: -250 });
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('throws on an unsupported version', () => {
    expect(() => migrate({ version: 7 })).toThrow('Unsupported save version: 7');
    expect(() => migrate(null)).toThrow('Unsupported save version: undefined');
  });

  it('throws on a corrupt save of each version', () => {
    expect(() => migrate({ version: 4 })).toThrow('Corrupt save data (version 4)');
    expect(() => migrate({ version: 5 })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), character: { portrait: 'character-01', xp: 0, survivalBest: 0 } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), character: { name: '', portrait: 'character-01', xp: 0 } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ version: 3 })).toThrow('Corrupt save data (version 3)');
    expect(() => migrate({ version: 2 })).toThrow('Corrupt save data (version 2)');
    expect(() => migrate({ version: 1, playerId: 'noah' })).toThrow('Corrupt save data (version 1)');
  });

  it('throws on an activeEncounter with no spec.id (F1)', () => {
    expect(() => migrate({ ...emptySave('noah'), activeEncounter: { junk: true } })).toThrow('Corrupt save data (version 6)');
  });

  it('throws on an activeEncounter that is missing any field the Encounter screen reads', () => {
    const live = startEncounter(spec, 5, NOW);
    expect(migrate({ ...emptySave('noah'), activeEncounter: live }).activeEncounter).toEqual(live);
    for (const field of Object.keys(live) as (keyof typeof live)[]) {
      const { [field]: _dropped, ...partial } = live;
      expect(() => migrate({ ...emptySave('noah'), activeEncounter: partial }), field).toThrow('Corrupt save data (version 6)');
    }
    expect(() => migrate({ ...emptySave('noah'), activeEncounter: { ...live, status: 'paused' } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), activeEncounter: { ...live, spec: { id: 'e1' } } })).toThrow('Corrupt save data (version 6)');
  });

  it('throws on an activeEncounter whose Spells contain anything but a real Attempt', () => {
    const live = castSpell(startEncounter(spec, 5, NOW), spell(), 4000, NOW);
    expect(migrate({ ...emptySave('noah'), activeEncounter: live }).activeEncounter).toEqual(live);
    expect(() => migrate({ ...emptySave('noah'), activeEncounter: { ...live, spells: [null] } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), activeEncounter: { ...live, spells: [{ factId: 'tt:3x4' }] } })).toThrow('Corrupt save data (version 6)');
  });

  it('throws on a save whose XP is not finite', () => {
    for (const xp of [NaN, Infinity]) {
      expect(() => migrate({ ...emptySave('noah'), character: { name: '', portrait: 'character-01', xp, survivalBest: 0 } })).toThrow('Corrupt save data (version 6)');
    }
  });

  it('rejects a save whose attempts or encounters contain anything but a real record (F1)', () => {
    expect(() => migrate({ ...emptySave('noah'), attempts: [{ nonsense: true }, 7, null] })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), encounters: [null, { junk: 1 }] })).toThrow('Corrupt save data (version 6)');
  });

  it('round-trips a real played, won save unchanged (F1)', () => {
    let { save, encounter } = beginEncounter(emptySave('noah'), QUEST_1.encounters[0]!, NOW, 'e1');
    while (encounter.status === EncounterStatus.Active) {
      const p = nextProblem(save, encounter, NOW, () => 0.5);
      ({ save, encounter } = cast(save, encounter, QUEST_1.encounters[0]!, p, p.answer, 1000, NOW, () => 0.5));
    }
    expect(encounter.status).toBe(EncounterStatus.Won);
    expect(migrate(save)).toEqual(save);
  });
});

describe('version 6 (invariant 6)', () => {
  const grid = { ...attempt, factId: 'md:2x1', operands: [47, 6] as [number, number], work: [42, null], labelsShown: true };

  it('creates an empty save at version 6 with the Work labels shown', () => {
    expect(emptySave('noah').version).toBe(6);
    expect(emptySave('noah').settings).toEqual({ hideWorkLabels: false });
  });

  it('loads a version 5 save as version 6 with every Attempt unchanged', () => {
    const { settings: _drop, ...rest } = withAttempt(emptySave('noah'), attempt);
    const v5 = JSON.parse(JSON.stringify({ ...rest, version: 5 }));
    const loaded = migrate(v5);
    expect(loaded.version).toBe(6);
    expect(loaded.settings).toEqual({ hideWorkLabels: false });
    expect(loaded.attempts).toEqual([attempt]);
    expect('work' in loaded.attempts[0]!).toBe(false);
  });

  it('keeps a grid Attempt byte for byte', () => {
    const data = withAttempt(emptySave('noah'), grid);
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('rejects a malformed grid field or setting', () => {
    const bad = (a: object) => () => migrate({ ...emptySave('noah'), attempts: [{ ...grid, ...a }] });
    expect(bad({ operands: [47] })).toThrow('Corrupt save data (version 6)');
    expect(bad({ operands: [47, 6.5] })).toThrow('Corrupt save data (version 6)');
    expect(bad({ work: [42, 'x'] })).toThrow('Corrupt save data (version 6)');
    expect(bad({ labelsShown: 'yes' })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), settings: { hideWorkLabels: 'no' } })).toThrow('Corrupt save data (version 6)');
    expect(() => migrate({ ...emptySave('noah'), settings: undefined })).toThrow('Corrupt save data (version 6)');
  });

  it('withWorkLabelsHidden sets the setting either way and nothing else', () => {
    const before = emptySave('noah');
    const hidden = withWorkLabelsHidden(before, true);
    expect(hidden).toEqual({ ...before, settings: { hideWorkLabels: true } });
    expect(withWorkLabelsHidden(hidden, false)).toEqual(before);
  });
});
