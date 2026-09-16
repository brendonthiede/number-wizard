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

  // Every persisted save flows through here so the buzzer can forfeit the latest live Encounter.
  const persist = (save: SaveData, encounter: Encounter) => {
    setState({ save, encounter });
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

  const onFinish = (save: SaveData, finished: Encounter) => {
    setRun(recordRunEncounter(run, finished));
    persist(save, finished);
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
      onSave={(save) => { setState((s) => ({ save, encounter: save.activeEncounter ?? s.encounter })); onSave(save); }}
      onFinish={onFinish}
      now={now}
      rng={rng}
      clock={clockText(remaining)}
    />
  );
}
