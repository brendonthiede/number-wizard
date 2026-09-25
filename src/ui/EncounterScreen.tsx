import { useEffect, useState } from 'react';
import { cast, nextProblem, type EncounterTemplate } from '../game/play';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { checkWork } from '../engine/multiDigit';
import { Outcome, type Problem } from '../engine/types';
import { withWorkLabelsHidden, type SaveData } from '../storage/save';
import { AnswerInput } from './AnswerInput';
import { art } from './art';
import { HpHearts, MonsterPips } from './Hp';
import { GRID_MAX_DIGITS, Keypad } from './Keypad';
import { MonsterArt } from './MonsterArt';
import { Effect, playEffect } from './sound';
import { WorkGrid } from './WorkGrid';

export const FEEDBACK_MS = { hit: 1500, miss: 3000 } as const;

const BANNER: Record<Exclude<Outcome, typeof Outcome.Miss>, string> = {
  [Outcome.Critical]: 'Critical Hit!',
  [Outcome.Hit]: 'Hit!',
  [Outcome.Glancing]: 'Glancing Blow!',
};

const EFFECT_BY_OUTCOME: Record<Outcome, Effect> = {
  [Outcome.Critical]: Effect.Critical, [Outcome.Hit]: Effect.Hit, [Outcome.Glancing]: Effect.Glancing, [Outcome.Miss]: Effect.Miss,
};

interface Feedback {
  outcome: Outcome;
  problem: Problem;
  marks: boolean[] | null;
}

/** The feedback banner for a Spell; a Miss shows the full Fact so the right answer is seen before moving on. */
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
  // One string per input: a table Problem has just the answer; a grid has its Work cells, then the answer.
  const blank = (p: Problem) => Array<string>((p.work?.length ?? 0) + 1).fill('');
  const [cells, setCells] = useState(() => blank(problem));
  const [active, setActive] = useState(0);
  const [peek, setPeek] = useState(false);
  // True if the Work labels were visible at any moment of this Problem, even a peek closed before casting.
  const [labelsSeen, setLabelsSeen] = useState(() => !save.settings.hideWorkLabels);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const grid = problem.work !== undefined;
  const last = cells.length - 1;
  const showLabels = !state.save.settings.hideWorkLabels || peek;
  const setCell = (i: number, v: string) => setCells((cs) => cs.map((c, j) => (j === i ? v : c)));

  /** Hiding sets the Player's default at once; showing while hidden is the default is a peek for this Problem only. */
  const toggleLabels = () => {
    if (!showLabels) {
      setPeek(true);
      setLabelsSeen(true);
      return;
    }
    setPeek(false);
    if (!state.save.settings.hideWorkLabels) {
      const hidden = withWorkLabelsHidden(state.save, true);
      setState({ ...state, save: hidden });
      onSave(hidden, state.encounter);
    }
  };

  /** Casts a submitted answer and reports the resulting save and Encounter before feedback clears. */
  const doCast = () => {
    const answer = cells[last];
    if (!answer || feedback) return;
    const at = now();
    const entered = cells.slice(0, last).map((c) => (c === '' ? null : Number(c)));
    // Clamped: a device clock stepping back mid-Problem must never store a negative duration (PR #13).
    const result = cast(
      state.save, state.encounter, template, problem, Number(answer), Math.max(0, at.getTime() - shownAt), at, rng,
      grid ? { entered, labelsShown: labelsSeen } : undefined,
    );
    setState(result);
    onSave(result.save, result.encounter);
    playEffect(EFFECT_BY_OUTCOME[result.outcome]);
    setFeedback({ outcome: result.outcome, problem, marks: problem.work ? checkWork(problem.work.map((c) => c.value), entered) : null });
  };

  /** Clears the feedback, then either ends the Encounter or serves the next Problem with its inputs reset. */
  const advance = () => {
    setFeedback(null);
    if (state.encounter.status !== EncounterStatus.Active) {
      onFinish(state.save, state.encounter);
      return;
    }
    const next = nextProblem(state.save, state.encounter, now(), rng);
    setProblem(next);
    setCells(blank(next));
    setActive(0);
    setPeek(false);
    setLabelsSeen(!state.save.settings.hideWorkLabels);
    setShownAt(now().getTime());
  };

  // A Glancing Blow or a Miss on a grid has Work to read, so it waits for the Next button instead of a timer.
  const waits = feedback !== null && feedback.marks !== null && (feedback.outcome === Outcome.Glancing || feedback.outcome === Outcome.Miss);

  useEffect(() => {
    if (!feedback || waits) return;
    const timer = setTimeout(advance, feedback.outcome === Outcome.Miss ? FEEDBACK_MS.miss : FEEDBACK_MS.hit);
    return () => clearTimeout(timer);
  }, [feedback]);

  const { character } = state.save;
  const e = state.encounter;
  const locked = feedback !== null;

  return (
    <main className={grid ? 'screen encounter with-grid' : 'screen encounter'}>
      <header className="status">
        <div className="fighter">
          <img className="portrait-small" src={art(`character/${character.portrait}`)} alt="" />
          <span>{character.name}</span>
          <HpHearts hp={e.characterHp} maxHp={e.characterMaxHp} />
        </div>
        {clock && <span className="clock" role="timer" aria-label={`Time left ${clock}`}>{clock}</span>}
        <div className="fighter">
          <span>{template.monsterName}</span>
          <MonsterPips hp={e.monsterHp} maxHp={e.spec.monsterMaxHp} />
        </div>
      </header>
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${template.background}`)})` }}>
        <MonsterArt monsterId={e.spec.monsterId} />
        {feedback && <div className="banner" role="status">{bannerText(feedback)}</div>}
      </section>
      <section className="problem">
        {grid ? (
          <WorkGrid
            problem={problem} cells={cells} active={active} onActive={setActive} onChange={setCell} onCast={doCast}
            disabled={locked} showLabels={showLabels} onToggleLabels={toggleLabels} marks={waits && feedback ? feedback.marks : null}
          />
        ) : (
          <>
            <span className="prompt">{problem.prompt} =</span>
            <AnswerInput value={cells[0] ?? ''} onChange={(v) => setCell(0, v)} onCast={doCast} disabled={locked} focusKey={problem} />
          </>
        )}
        {waits && <button type="button" className="primary" onClick={advance} autoFocus>Next Problem</button>}
      </section>
      <Keypad
        value={cells[active] ?? ''} onChange={(v) => setCell(active, v)} onCast={doCast} disabled={locked}
        onNext={grid ? () => setActive((i) => (i + 1) % cells.length) : undefined}
        maxDigits={grid ? GRID_MAX_DIGITS : undefined}
        canCast={Boolean(cells[last])}
      />
    </main>
  );
}
