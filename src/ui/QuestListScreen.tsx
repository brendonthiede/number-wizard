import type { Quest } from '../content/quest1';
import { useFocusOnMount } from './useFocusOnMount';

interface QuestListScreenProps {
  quests: Quest[]; // open Quests only, in campaign order
  onPick: (quest: Quest) => void;
  onTitle: () => void;
}

/** The open Quests by name, newest focused. A plain list until the Map exists. */
export function QuestListScreen({ quests, onPick, onTitle }: QuestListScreenProps) {
  const newest = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen quest">
      <h1>Quests</h1>
      <ol className="quest-list">
        {quests.map((q, i) => (
          <li key={q.id}>
            <button type="button" className="quest-row" ref={i === quests.length - 1 ? newest : undefined} onClick={() => onPick(q)}>
              <span className="quest-name">{q.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onTitle}>Title</button>
    </main>
  );
}
