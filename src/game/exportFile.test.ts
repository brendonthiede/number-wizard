import { describe, expect, it } from 'vitest';
import { buildExport, EXPORT_KIND, exportFileName, ImportKind, parseImport } from './exportFile';
import { PLAN_KIND } from './learningPlan';
import { beginEncounter, cast, nextProblem } from './play';
import { QUEST_1 } from '../content/quest1';
import { castSpell, EncounterStatus, startEncounter, type EncounterSpec } from '../engine/combat';
import { emptySave, withActiveEncounter, withAttempt, withCharacter, withLearningPlan } from '../storage/save';

const NOW = new Date('2026-09-18T15:04:05.000Z');
const played = () => {
  let { save, encounter } = beginEncounter(withCharacter(emptySave('noah'), 'Noah', 'character-02'), QUEST_1.encounters[0]!, NOW, 'e1');
  const p = nextProblem(save, encounter, NOW, () => 0.5);
  ({ save } = cast(save, encounter, QUEST_1.encounters[0]!, p, p.answer, 1000, NOW, () => 0.5));
  return withLearningPlan(save, { kind: PLAN_KIND, version: 1, note: 'n' }, NOW);
};

describe('Export', () => {
  it('wraps the whole save with a kind and a time, named for the Player and the day', () => {
    const save = played();
    expect(buildExport(save, NOW)).toEqual({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save });
    expect(EXPORT_KIND).toBe('number-wizard-export');
    expect(exportFileName(save, NOW)).toBe('number-wizard-noah-2026-09-18.json');
  });

  it('round-trips through parseImport to an equal save (invariant 2)', () => {
    const save = played();
    expect(parseImport(JSON.stringify(buildExport(save, NOW)))).toEqual({ kind: ImportKind.Save, save });
  });
});

describe('parseImport', () => {
  it('recognises a Learning Plan', () => {
    const plan = { kind: PLAN_KIND, version: 1, monsterHpScale: 2 };
    expect(parseImport(JSON.stringify(plan))).toEqual({ kind: ImportKind.Plan, plan });
  });

  it('rejects anything else in plain words and never returns a partial result', () => {
    expect(() => parseImport('not json')).toThrow('That is not valid JSON.');
    expect(() => parseImport('{"kind":"mystery"}')).toThrow('That is neither a Learning Plan nor an Export.');
    expect(() => parseImport(JSON.stringify({ kind: EXPORT_KIND, save: { version: 99 } }))).toThrow('Unsupported save version: 99');
    expect(() => parseImport(JSON.stringify({ kind: PLAN_KIND, version: 1, monsterHpScale: 9 }))).toThrow('monsterHpScale');
  });

  it('rejects an Export wrapping a save with corrupt attempts or encounters (F1)', () => {
    const badAttempts = { ...emptySave('noah'), attempts: [{ nonsense: true }, 7, null] };
    expect(() => parseImport(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: badAttempts }))).toThrow('Corrupt save data (version 6)');
    const badEncounters = { ...emptySave('noah'), encounters: [null, { junk: 1 }] };
    expect(() => parseImport(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: badEncounters }))).toThrow('Corrupt save data (version 6)');
  });

  it('yields a version-6 save with a null Learning Plan for a version-4 Export (F8)', () => {
    const { learningPlan: _none, ...v4 } = emptySave('noah');
    const wrapped = { kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: { ...v4, version: 4 } };
    expect(parseImport(JSON.stringify(wrapped))).toEqual({ kind: ImportKind.Save, save: emptySave('noah') });
  });

  it('closes an open Encounter this build no longer has as a Retreat, keeping its XP (F2)', () => {
    const spec: EncounterSpec = { id: 'e9', questId: 'fortress-of-twelves', monsterId: 'retired-monster', monsterMaxHp: 5 };
    let encounter = startEncounter(spec, 5, NOW);
    encounter = castSpell(encounter, { factId: 'tt:3x4', answer: 12, correct: true, workCorrect: true, durationMs: 1000 }, 4000, NOW);
    const save = withActiveEncounter(emptySave('noah'), encounter);
    const result = parseImport(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save }));
    expect(result.kind).toBe(ImportKind.Save);
    if (result.kind !== ImportKind.Save) return;
    expect(result.save.activeEncounter).toBeNull();
    expect(result.save.encounters).toEqual([{
      id: 'e9', questId: 'fortress-of-twelves', monsterId: 'retired-monster', monsterMaxHp: 5,
      startedAt: NOW.toISOString(), endedAt: NOW.toISOString(), status: EncounterStatus.Retreated, xp: 2, loot: null,
    }]);
  });

  it('keeps a resolvable open Encounter as-is (F2)', () => {
    let { save, encounter } = beginEncounter(emptySave('noah'), QUEST_1.encounters[0]!, NOW, 'e1');
    const p = nextProblem(save, encounter, NOW, () => 0.5);
    ({ save } = cast(save, encounter, QUEST_1.encounters[0]!, p, p.answer, 1000, NOW, () => 0.5));
    expect(save.activeEncounter).not.toBeNull();
    expect(parseImport(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save }))).toEqual({ kind: ImportKind.Save, save });
  });

  it('an Export holding a grid Attempt survives Import unchanged (invariant 6)', () => {
    const grid = {
      factId: 'md:2x2', answer: 1692, correct: true, durationMs: 30000, at: '2026-09-18T12:00:00.000Z', encounterId: 'e1',
      outcome: 'hit' as const, operands: [47, 36] as [number, number], work: [42, 240, 210, 1200], labelsShown: false,
    };
    const save = withAttempt(emptySave('noah'), grid);
    const parsed = parseImport(JSON.stringify(buildExport(save, new Date('2026-09-18T13:00:00Z'))));
    expect(parsed.kind).toBe(ImportKind.Save);
    if (parsed.kind === ImportKind.Save) expect(parsed.save).toEqual(save);
  });
});
