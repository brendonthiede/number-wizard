import type { Quest, QuestEncounter } from '../content/quest1';
import { art } from './art';
import { MonsterArt } from './MonsterArt';
import { useFocusOnMount } from './useFocusOnMount';
import { ScreenNav } from './ScreenNav';

interface StoryPanelScreenProps {
  quest: Quest;
  encounter: QuestEncounter;
  onFight: () => void;
}

/** The comic panel before a fight: Quest background, the monster, two sentences, and a focused Fight button. */
export function StoryPanelScreen({ quest, encounter, onFight }: StoryPanelScreenProps) {
  const primary = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen story">
      <div className="screen-body">
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${quest.background}`)})` }}>
        <MonsterArt monsterId={encounter.monsterId} />
      </section>
      <p className="story-text">{encounter.story.text}</p>
      </div>
      <ScreenNav>
        <button type="button" className="primary" onClick={onFight} ref={primary}>Fight</button>
      </ScreenNav>
    </main>
  );
}
