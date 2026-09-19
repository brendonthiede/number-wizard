import { Outcome, type Attempt, type FactId } from './types';

export interface SpellInput {
  factId: FactId;
  answer: number | null;
  correct: boolean;
  workCorrect: boolean;
  durationMs: number;
  // Work grid Spells only. `work` present is what marks the Attempt as a grid Attempt.
  operands?: [number, number];
  work?: (number | null)[];
  labelsShown?: boolean;
}

/** Turns one cast into its Outcome: a Miss on a wrong answer, a Glancing Blow on wrong Work, else Critical or Hit by speed. */
export function resolveSpell(input: SpellInput, thresholdMs: number): Outcome {
  if (!input.correct) return Outcome.Miss;
  if (!input.workCorrect) return Outcome.Glancing;
  return input.durationMs < thresholdMs ? Outcome.Critical : Outcome.Hit;
}

const DAMAGE: Record<Outcome, number> = { [Outcome.Critical]: 2, [Outcome.Hit]: 1, [Outcome.Glancing]: 1, [Outcome.Miss]: 0 };
/** Monster damage dealt by an Outcome. */
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

/**
 * Starts an Encounter at full monster and Character HP.
 *
 * @throws {Error} When monster or Character max HP is not positive (F9).
 */
export function startEncounter(spec: EncounterSpec, characterMaxHp: number, now: Date): Encounter {
  if (spec.monsterMaxHp < 1) throw new Error(`Encounter ${spec.id} cannot start: monster HP ${spec.monsterMaxHp}`);
  if (characterMaxHp < 1) throw new Error(`Encounter ${spec.id} cannot start: Character HP ${characterMaxHp}`);
  return {
    spec, monsterHp: spec.monsterMaxHp, characterHp: characterMaxHp, characterMaxHp,
    spells: [], startedAt: now.toISOString(), status: EncounterStatus.Active,
  };
}

/**
 * Records one Spell against an active Encounter and applies its damage, resolving Won or Retreated.
 *
 * @throws {Error} When the Encounter has already ended.
 */
export function castSpell(encounter: Encounter, input: SpellInput, thresholdMs: number, now: Date): Encounter {
  if (encounter.status !== EncounterStatus.Active) throw new Error(`Encounter ${encounter.spec.id} is ${encounter.status}`);
  const outcome = resolveSpell(input, thresholdMs);
  const attempt: Attempt = {
    factId: input.factId, answer: input.answer, correct: input.correct, durationMs: input.durationMs,
    at: now.toISOString(), encounterId: encounter.spec.id, outcome,
    // Table Attempts must keep exactly their old keys: the save is compared and exported as written.
    ...(input.work !== undefined && { operands: input.operands, work: input.work, labelsShown: input.labelsShown }),
  };
  const monsterHp = Math.max(0, encounter.monsterHp - damageOf(outcome));
  const characterHp = Math.max(0, encounter.characterHp - (outcome === Outcome.Miss ? 1 : 0));
  const status: EncounterStatus = monsterHp === 0 ? EncounterStatus.Won : characterHp === 0 ? EncounterStatus.Retreated : EncounterStatus.Active;
  return { ...encounter, monsterHp, characterHp, spells: [...encounter.spells, attempt], status };
}

/** The distinct Facts already cast in this Encounter. */
export const servedFacts = (encounter: Encounter): Set<FactId> => new Set(encounter.spells.map((s) => s.factId));

/** Picks one Loot id from the pool by the RNG, clamped to a valid index; null for an empty pool. */
export const rollLoot = (pool: string[], rng: () => number = Math.random): string | null =>
  pool.length ? pool[Math.max(0, Math.min(pool.length - 1, Math.floor(rng() * pool.length)))]! : null;
