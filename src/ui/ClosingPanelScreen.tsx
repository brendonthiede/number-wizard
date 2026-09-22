import type { Quest } from '../content/quest1';
import { art } from './art';
import { useFocusOnMount } from './useFocusOnMount';
import { ScreenNav } from './ScreenNav';

/** The panel after the boss falls: the Quest background, the closing text, and a focused Title button. */
export function ClosingPanelScreen({ quest, onTitle }: { quest: Quest; onTitle: () => void }) {
  const primary = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen story">
      <div className="screen-body">
      <section className="panel" style={{ backgroundImage: `url(${art(`background/${quest.background}`)})` }} />
      <p className="story-text">{quest.closing.text}</p>
      </div>
      <ScreenNav>
        <button type="button" className="primary" onClick={onTitle} ref={primary}>Title</button>
      </ScreenNav>
    </main>
  );
}
