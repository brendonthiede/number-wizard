import { Outcome, type Attempt, type FactId } from './types';

export interface SpellInput {
  factId: FactId;
  answer: number | null;
  correct: boolean;
  workCorrect: boolean;
  durationMs: number;
}

export function resolveSpell(input: SpellInput, thresholdMs: number): Outcome {
  if (!input.correct) return Outcome.Miss;
  if (!input.workCorrect) return Outcome.Glancing;
  return input.durationMs < thresholdMs ? Outcome.Critical : Outcome.Hit;
}

const DAMAGE: Record<Outcome, number> = { [Outcome.Critical]: 2, [Outcome.Hit]: 1, [Outcome.Glancing]: 1, [Outcome.Miss]: 0 };
export const damageOf = (outcome: Outcome): number => DAMAGE[outcome];

export interface EncounterSpec {
  id: string;
  questId: string;
  monsterId: string;
  monsterMaxHp: number;
}

export const EncounterStatus = { Active: 'active', Won: 'won', Retreated: 'retreated' } as const;
export type EncounterStatus = (typeof EncounterStatus)[keyof typeof EncounterStatus];

export interface Encounter {
  spec: EncounterSpec;
  monsterHp: number;
  characterHp: number;
  characterMaxHp: number;
  spells: Attempt[];
  startedAt: string;
  status: EncounterStatus;
}

export function startEncounter(spec: EncounterSpec, characterMaxHp: number, now: Date): Encounter {
  if (spec.monsterMaxHp < 1) throw new Error(`Encounter ${spec.id} cannot start: monster HP ${spec.monsterMaxHp}`);
  if (characterMaxHp < 1) throw new Error(`Encounter ${spec.id} cannot start: Character HP ${characterMaxHp}`);
  return {
    spec, monsterHp: spec.monsterMaxHp, characterHp: characterMaxHp, characterMaxHp,
    spells: [], startedAt: now.toISOString(), status: EncounterStatus.Active,
  };
}

export function castSpell(encounter: Encounter, input: SpellInput, thresholdMs: number, now: Date): Encounter {
  if (encounter.status !== EncounterStatus.Active) throw new Error(`Encounter ${encounter.spec.id} is ${encounter.status}`);
  const outcome = resolveSpell(input, thresholdMs);
  const attempt: Attempt = {
    factId: input.factId, answer: input.answer, correct: input.correct, durationMs: input.durationMs,
    at: now.toISOString(), encounterId: encounter.spec.id, outcome,
  };
  const monsterHp = Math.max(0, encounter.monsterHp - damageOf(outcome));
  const characterHp = Math.max(0, encounter.characterHp - (outcome === Outcome.Miss ? 1 : 0));
  const status: EncounterStatus = monsterHp === 0 ? EncounterStatus.Won : characterHp === 0 ? EncounterStatus.Retreated : EncounterStatus.Active;
  return { ...encounter, monsterHp, characterHp, spells: [...encounter.spells, attempt], status };
}

export const servedFacts = (encounter: Encounter): Set<FactId> => new Set(encounter.spells.map((s) => s.factId));

export const rollLoot = (pool: string[], rng: () => number = Math.random): string | null =>
  pool.length ? pool[Math.max(0, Math.min(pool.length - 1, Math.floor(rng() * pool.length)))]! : null;
