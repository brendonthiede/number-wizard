import { useEffect, useState } from 'react';
import { EncounterStatus, type Encounter } from '../engine/combat';
import { beginEncounter, type EncounterTemplate } from '../game/play';
import { clockText, endRun, forfeitEncounter, recordRunEncounter, remainingMs, startRun, type SurvivalRun } from '../game/survival';
import type { SaveData } from '../storage/save';
import { EncounterScreen, FEEDBACK_MS } from './EncounterScreen';

const TICK_MS = 250;

interface SurvivalScreenProps {
  save: SaveData;
  template: EncounterTemplate;
  onSave: (save: SaveData) => void;
  onEnd: (save: SaveData, run: SurvivalRun, newBest: boolean) => void;
  now?: () => Date;
  rng?: () => number;
}

interface Flash {
  text: string;
}

export function SurvivalScreen({ save: initial, template, onSave, onEnd, now = () => new Date(), rng = Math.random }: SurvivalScreenProps) {
  const [run, setRun] = useState(() => startRun(now()));
  const [state, setState] = useState(() => beginEncounter(initial, template, now(), undefined));
  const [xpBefore, setXpBefore] = useState(initial.character.xp);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [remaining, setRemaining] = useState(() => remainingMs(run, now()));

  // Every cast lands here at once, finished or not: the buzzer must see the terminal Encounter, not the
  // one from before the last Spell, or it would record the fight twice and miss the win.
  const persist = (save: SaveData, encounter: Encounter) => {
    setState({ save, encounter });
    if (encounter.status !== EncounterStatus.Active) setRun((r) => recordRunEncounter(r, encounter));
    onSave(save);
  };

  useEffect(() => {
    const timer = setInterval(() => setRemaining(remainingMs(run, now())), TICK_MS);
    return () => clearInterval(timer);
  }, [run]);

  useEffect(() => {
    if (remaining > 0) return;
    const save = forfeitEncounter(state.save, state.encounter);
    const ended = endRun(save, run);
    onSave(ended.save);
    onEnd(ended.save, run, ended.newBest);
  }, [remaining]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => {
      setFlash(null);
      if (remainingMs(run, now()) === 0) return; // the buzzer effect ends the run
      const next = beginEncounter(state.save, template, now(), undefined);
      setXpBefore(state.save.character.xp);
      persist(next.save, next.encounter);
    }, FEEDBACK_MS.hit);
    return () => clearTimeout(timer);
  }, [flash]);

  // The banner has already cleared by now; the result was recorded at cast time.
  const onFinish = (save: SaveData, finished: Encounter) => {
    const gained = save.character.xp - xpBefore;
    setFlash({ text: finished.status === EncounterStatus.Won ? `Victory! +${gained} XP` : `Retreat. +${gained} XP` });
  };

  if (flash) {
    return (
      <main className="screen survival-flash">
        <p className="banner" role="status">{flash.text}</p>
      </main>
    );
  }

  return (
    <EncounterScreen
      key={state.encounter.spec.id}
      save={state.save}
      encounter={state.encounter}
      template={template}
      onSave={persist}
      onFinish={onFinish}
      now={now}
      rng={rng}
      clock={clockText(remaining)}
    />
  );
}
