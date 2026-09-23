import type { Quest } from '../content/quest1';
import { EncounterState, nextOpenIndex, questProgress, questComplete } from '../game/quest';
import { scaledHp } from '../game/learningPlan';
import type { SaveData } from '../storage/save';
import { MonsterPips } from './Hp';
import { ScreenNav } from './ScreenNav';
import { useFocusOnMount } from './useFocusOnMount';

interface QuestScreenProps {
  save: SaveData;
  quest: Quest;
  onPick: (index: number) => void;
  onTitle: () => void;
  onFreeRoam: () => void; // a random fight in the region; offered once the Quest is complete
}

const STATE_LABEL: Record<EncounterState, string> = {
  [EncounterState.Won]: 'Won',
  [EncounterState.Open]: '',
  [EncounterState.Locked]: 'Locked',
};

/** The Quest's Encounters in order; locked rows are disabled and the next open row starts focused. Once the Quest is complete, Free Roam starts a random fight in the region. */
export function QuestScreen({ save, quest, onPick, onTitle, onFreeRoam }: QuestScreenProps) {
  const progress = questProgress(save, quest);
  const focusIndex = nextOpenIndex(save, quest);
  const focused = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen quest">
      <div className="screen-body">
      <h1>{quest.name}</h1>
      <ol className="quest-list">
        {quest.encounters.map((e, i) => {
          const hp = scaledHp(save, e.monsterMaxHp);
          return (
            <li key={e.monsterId}>
              <button
                type="button"
                className="quest-row"
                ref={i === focusIndex ? focused : undefined}
                disabled={progress[i] === EncounterState.Locked}
                onClick={() => onPick(i)}
              >
                <span className="quest-name">{e.monsterName}</span>
                <MonsterPips hp={hp} maxHp={hp} />
                <span className="quest-state">{STATE_LABEL[progress[i]!]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      </div>
      <ScreenNav>
        <button type="button" onClick={onTitle}>Title</button>
        {questComplete(save, quest) && <button type="button" onClick={onFreeRoam}>Free Roam</button>}
      </ScreenNav>
    </main>
  );
}
