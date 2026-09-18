import { describe, expect, it } from 'vitest';
import { buildExport, EXPORT_KIND, exportFileName, ImportKind, parseImport } from './exportFile';
import { PLAN_KIND } from './learningPlan';
import { beginEncounter, cast, nextProblem } from './play';
import { QUEST_1 } from '../content/quest1';
import { emptySave, withCharacter, withLearningPlan } from '../storage/save';

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
    expect(() => parseImport(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: badAttempts }))).toThrow('Corrupt save data (version 5)');
    const badEncounters = { ...emptySave('noah'), encounters: [null, { junk: 1 }] };
    expect(() => parseImport(JSON.stringify({ kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: badEncounters }))).toThrow('Corrupt save data (version 5)');
  });

  it('yields a version-5 save with a null Learning Plan for a version-4 Export (F8)', () => {
    const { learningPlan: _none, ...v4 } = emptySave('noah');
    const wrapped = { kind: EXPORT_KIND, exportedAt: NOW.toISOString(), save: { ...v4, version: 4 } };
    expect(parseImport(JSON.stringify(wrapped))).toEqual({ kind: ImportKind.Save, save: emptySave('noah') });
  });
});
