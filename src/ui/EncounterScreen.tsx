import { useEffect, useState } from 'react';
import { cast, nextProblem, type EncounterTemplate } from '../game/play';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { Outcome, type Problem } from '../engine/types';
import type { SaveData } from '../storage/save';
import { AnswerInput } from './AnswerInput';
import { art } from './art';
import { HpHearts, MonsterPips } from './Hp';
import { Keypad } from './Keypad';
import { MonsterArt } from './MonsterArt';

export const FEEDBACK_MS = { hit: 1500, miss: 3000 } as const;

const BANNER: Record<Exclude<Outcome, typeof Outcome.Miss>, string> = {
  [Outcome.Critical]: 'Critical Hit!',
  [Outcome.Hit]: 'Hit!',
  [Outcome.Glancing]: 'Glancing Blow!',
};

interface Feedback {
  outcome: Outcome;
  problem: Problem;
}

const bannerText = ({ outcome, problem }: Feedback): string =>
  outcome === Outcome.Miss ? `Miss. ${problem.prompt} = ${problem.answer}` : BANNER[outcome];

interface EncounterScreenProps {
  save: SaveData;
  encounter: Encounter;
  template: EncounterTemplate;
  onSave: (save: SaveData, encounter: Encounter) => void; // after every cast, finished or not
  onFinish: (save: SaveData, encounter: Encounter) => void;
  now?: () => Date;
  rng?: () => number;
  clock?: string; // Survival only: the run's m:ss countdown. The per-Problem speed clock stays silent.
}

/** Renders an Encounter, reports every cast through `onSave`, and optionally shows a Survival clock. */
export function EncounterScreen({ save, encounter, template, onSave, onFinish, now = () => new Date(), rng = Math.random, clock }: EncounterScreenProps) {
  // Seeded once; App remounts this screen with key=encounter.spec.id, so props never change underneath it.
  const [state, setState] = useState({ save, encounter });
  const [problem, setProblem] = useState(() => nextProblem(save, encounter, now(), rng));
  const [shownAt, setShownAt] = useState(() => now().getTime());
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /** Casts a submitted answer and reports the resulting save and Encounter before feedback clears. */
  const doCast = () => {
    if (!value || feedback) return;
    const at = now();
    // Clamped: a device clock stepping back mid-Problem must never store a negative duration (PR #13).
    const result = cast(state.save, state.encounter, template, problem, Number(value), Math.max(0, at.getTime() - shownAt), at, rng);
    setState(result);
    onSave(result.save, result.encounter);
    setFeedback({ outcome: result.outcome, problem });
    setValue('');
  };

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
      if (state.encounter.status !== EncounterStatus.Active) {
        onFinish(state.save, state.encounter);
        return;
      }
      setProblem(nextProblem(state.save, state.encounter, now(), rng));
      setShownAt(now().getTime());
    }, feedback.outcome === Outcome.Miss ? FEEDBACK_MS.miss : FEEDBACK_MS.hit);
    return () => clearTimeout(timer);
  }, [feedback]);

  const { character } = state.save;
  const e = state.encounter;
  const locked = feedback !== null;

  return (
    <main className="screen encounter">
      <header className="status">
        <div className="fighter">
          <img className="portrait-small" src={art(`character/${character.portrait}.png`)} alt="" />
          <span>{character.name}</span>
          <HpHearts hp={e.characterHp} maxHp={e.characterMaxHp} />
        </div>
        {clock && <span className="clock" role="timer" aria-label={`Time left ${clock}`}>{clock}</span>}
        <div className="fighter">
          <span>{template.monsterName}</span>
          <MonsterPips hp={e.monsterHp} maxHp={e.spec.monsterMaxHp} />
        </div>
      </header>
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${template.background}.png`)})` }}>
        <MonsterArt monsterId={e.spec.monsterId} />
        {feedback && <div className="banner" role="status">{bannerText(feedback)}</div>}
      </section>
      <section className="problem">
        <span className="prompt">{problem.prompt} =</span>
        <AnswerInput value={value} onChange={setValue} onCast={doCast} disabled={locked} focusKey={problem} />
      </section>
      <Keypad value={value} onChange={setValue} onCast={doCast} disabled={locked} />
    </main>
  );
}
