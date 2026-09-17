import type { Quest, QuestEncounter } from '../content/quest1';
import { art } from './art';
import { MonsterArt } from './MonsterArt';

interface StoryPanelScreenProps {
  quest: Quest;
  encounter: QuestEncounter;
  onFight: () => void;
}

/** The comic panel before a fight: Quest background, the monster, two sentences, and a focused Fight button. */
export function StoryPanelScreen({ quest, encounter, onFight }: StoryPanelScreenProps) {
  return (
    <main className="screen story">
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${quest.background}.png`)})` }}>
        <MonsterArt monsterId={encounter.monsterId} />
        <p className="story-text">{encounter.story.text}</p>
      </section>
      <button type="button" className="primary" onClick={onFight} autoFocus>Fight</button>
    </main>
  );
}
