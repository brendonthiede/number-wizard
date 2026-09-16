import { useEffect, useState } from 'react';
import { APP_TITLE, PLAYER_ID, QUEST_1_FIRST } from './content';
import type { Encounter } from './engine/combat';
import { beginEncounter } from './game/play';
import { emptySave, withCharacter, type SaveData, type Store } from './storage/save';
import { CreateScreen } from './ui/CreateScreen';
import { EncounterScreen } from './ui/EncounterScreen';
import { ResultScreen } from './ui/ResultScreen';
import { TitleScreen } from './ui/TitleScreen';

export { APP_TITLE };

const Screen = { Title: 'title', Create: 'create', Encounter: 'encounter', Result: 'result' } as const;
type Screen = (typeof Screen)[keyof typeof Screen];

export function App({ store }: { store: Store }) {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>(Screen.Title);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [xpBefore, setXpBefore] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  // The store is the only copy of the Player's history; a failed write is logged, never shown as an error mid-Encounter.
  const persist = (data: SaveData) => {
    setSave(data);
    store.save(data).catch((err: unknown) => console.error('save failed', err));
  };

  const play = (data: SaveData) => {
    setXpBefore(data.character.xp);
    if (data.activeEncounter) {
      setEncounter(data.activeEncounter);
    } else {
      const begun = beginEncounter(data, QUEST_1_FIRST, new Date());
      persist(begun.save);
      setEncounter(begun.encounter);
    }
    setScreen(Screen.Encounter);
  };

  useEffect(() => {
    let cancelled = false;
    store.load().then((loaded) => {
      if (cancelled) return;
      const data = loaded ?? emptySave(PLAYER_ID);
      setSave(data);
      if (!data.character.name) setScreen(Screen.Create);
      else if (data.activeEncounter) play(data);
    }).catch((err: unknown) => {
      if (cancelled) return;
      console.error('load failed', err);
      setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [store]);

  // A corrupt or unreadable blob is left untouched on disk for the Guide to recover; nothing is written back.
  if (loadFailed) {
    return (
      <main className="screen">
        <h1>The save could not be read.</h1>
        <p>Ask your Guide for help.</p>
      </main>
    );
  }

  if (!save) return null;

  switch (screen) {
    case Screen.Create:
      return <CreateScreen onBegin={(name, portrait) => { persist(withCharacter(save, name, portrait)); setScreen(Screen.Title); }} />;
    case Screen.Encounter:
      return (
        <EncounterScreen
          key={encounter!.spec.id}
          save={save}
          encounter={encounter!}
          template={QUEST_1_FIRST}
          onSave={persist}
          onFinish={(data, finished) => { persist(data); setEncounter(finished); setScreen(Screen.Result); }}
        />
      );
    case Screen.Result:
      return <ResultScreen save={save} encounter={encounter!} xpBefore={xpBefore} onAgain={() => play(save)} onTitle={() => setScreen(Screen.Title)} />;
    default:
      return <TitleScreen save={save} onPlay={() => play(save)} />;
  }
}
