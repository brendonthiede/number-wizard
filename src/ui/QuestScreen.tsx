import { useEffect, useRef } from 'react';
import type { Quest } from '../content/quest1';
import { EncounterState, nextOpenIndex, questProgress } from '../game/quest';
import type { SaveData } from '../storage/save';
import { MonsterPips } from './Hp';

interface QuestScreenProps {
  save: SaveData;
  quest: Quest;
  onPick: (index: number) => void;
  onTitle: () => void;
}

const STATE_LABEL: Record<EncounterState, string> = {
  [EncounterState.Won]: 'Won',
  [EncounterState.Open]: '',
  [EncounterState.Locked]: 'Locked',
};

/** The Quest's Encounters in order; locked rows are disabled and the next open row starts focused. */
export function QuestScreen({ save, quest, onPick, onTitle }: QuestScreenProps) {
  const progress = questProgress(save, quest);
  const focusIndex = nextOpenIndex(save, quest);
  const focused = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focused.current?.focus();
  }, []);
  return (
    <main className="screen quest">
      <h1>{quest.name}</h1>
      <ol className="quest-list">
        {quest.encounters.map((e, i) => (
          <li key={e.monsterId}>
            <button
              type="button"
              className="quest-row"
              ref={i === focusIndex ? focused : undefined}
              disabled={progress[i] === EncounterState.Locked}
              onClick={() => onPick(i)}
            >
              <span className="quest-name">{e.monsterName}</span>
              <MonsterPips hp={e.monsterMaxHp} maxHp={e.monsterMaxHp} />
              <span className="quest-state">{STATE_LABEL[progress[i]!]}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onTitle}>Title</button>
    </main>
  );
}
