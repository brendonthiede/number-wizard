import { useEffect, useLayoutEffect, useState } from 'react';
import { PLAYER_ID } from './content';
import { findTemplate, LOOT, QUEST_1, QUESTS, SURVIVAL_QUEST_ID, type Quest, type QuestEncounter } from './content/quest1';
import { EncounterStatus, type Encounter } from './engine/combat';
import { newlyEarned, type Achievement } from './game/achievements';
import { ownedLoot } from './game/loot';
import { beginEncounter } from './game/play';
import { openQuests } from './game/quest';
import { forfeitEncounter, survivalRoster, type SurvivalRun } from './game/survival';
import { emptySave, withCharacter, type SaveData, type Store } from './storage/save';
import { ClosingPanelScreen } from './ui/ClosingPanelScreen';
import { CreateScreen } from './ui/CreateScreen';
import { EncounterScreen } from './ui/EncounterScreen';
import { GuideScreen } from './ui/GuideScreen';
import { QuestListScreen } from './ui/QuestListScreen';
import { QuestScreen } from './ui/QuestScreen';
import { ResultScreen, type LootReveal } from './ui/ResultScreen';
import { StoryPanelScreen } from './ui/StoryPanelScreen';
import { SurvivalResultScreen } from './ui/SurvivalResultScreen';
import { SurvivalScreen } from './ui/SurvivalScreen';
import { TitleScreen } from './ui/TitleScreen';
import { TrophyCaseScreen } from './ui/TrophyCaseScreen';

const Screen = {
  Title: 'title', Create: 'create', Quests: 'quests', Quest: 'quest', Story: 'story', Encounter: 'encounter', Result: 'result',
  Closing: 'closing', Survival: 'survival', SurvivalResult: 'survival-result', Trophies: 'trophies', Guide: 'guide',
} as const;
type Screen = (typeof Screen)[keyof typeof Screen];

interface AppProps {
  store: Store;
  now?: () => Date;
  rng?: () => number;
}

/** Loads and persists the Player's save while coordinating normal, Survival, Trophy Case, and Guide screens. */
export function App({ store, now = () => new Date(), rng = Math.random }: AppProps) {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>(Screen.Title);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [pick, setPick] = useState<QuestEncounter>(QUEST_1.encounters[0]!);
  const [quest, setQuest] = useState<Quest>(QUEST_1);
  const [xpBefore, setXpBefore] = useState(0);
  // The reveal diff starts here: Spells cast before a reload or a forfeited fight are never
  // announced, by design; the Trophy Case still shows them.
  const [saveBefore, setSaveBefore] = useState<SaveData | null>(null);
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [runResult, setRunResult] = useState<{ run: SurvivalRun; newBest: boolean } | null>(null);
  const [loot, setLoot] = useState<LootReveal | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Every saved Encounter must map back to content; a spec that no longer resolves is treated as corrupt data.
  const templateFor = (e: Encounter): QuestEncounter => findTemplate(e.spec.questId, e.spec.monsterId)!;

  // The reveal reads the record just written: a won Quest fight with Loot recorded, never Survival, never a Retreat.
  const revealFor = (data: SaveData, finished: Encounter): LootReveal | null => {
    const record = data.encounters[data.encounters.length - 1];
    if (!record || finished.status !== EncounterStatus.Won || record.questId === SURVIVAL_QUEST_ID || record.loot === null) return null;
    const before = ownedLoot({ ...data, encounters: data.encounters.slice(0, -1) });
    return { id: record.loot, name: LOOT[record.loot] ?? record.loot, isNew: !before.has(record.loot) };
  };

  // A failed write is logged and flagged for the title/result screens, never shown as an error mid-Encounter.
  const persist = (data: SaveData) => {
    setSave(data);
    store.save(data).then(() => setSaveFailed(false)).catch((err: unknown) => {
      console.error('save failed', err);
      setSaveFailed(true);
    });
  };

  // The Quest a saved Encounter belongs to; a Survival fight belongs to none.
  const questOf = (e: Encounter): Quest | undefined => QUESTS.find((q) => q.id === e.spec.questId);

  // Play resumes the open Encounter without re-beginning it, so a reload never loses a fight. Otherwise
  // it opens the only open Quest, or the Quest list once there is a choice.
  const play = (data: SaveData) => {
    if (data.activeEncounter) {
      setXpBefore(data.character.xp);
      setSaveBefore(data);
      setEncounter(data.activeEncounter);
      setQuest(questOf(data.activeEncounter) ?? QUEST_1);
      setScreen(Screen.Encounter);
      return;
    }
    const open = openQuests(data);
    if (open.length === 1) {
      setQuest(open[0]!);
      setScreen(Screen.Quest);
    } else {
      setScreen(Screen.Quests);
    }
  };

  const fight = (data: SaveData, template: QuestEncounter) => {
    setXpBefore(data.character.xp);
    setSaveBefore(data);
    const begun = beginEncounter(data, template, now());
    persist(begun.save);
    setEncounter(begun.encounter);
    setScreen(Screen.Encounter);
  };

  /**
   * Starts a fresh run, first discarding an untouched normal Encounter or recording a started one
   * as a Retreat.
   */
  const survive = (data: SaveData) => {
    const closed = data.activeEncounter ? forfeitEncounter(data, data.activeEncounter) : data;
    if (closed !== data) persist(closed);
    setXpBefore(closed.character.xp);
    setSaveBefore(closed);
    setRunKey((k) => k + 1);
    setScreen(Screen.Survival);
  };

  // Screens swap without a page load, so without this a scrolled Quest list leaves the next screen half way down.
  // A layout effect, so the new screen never paints one frame at the old position.
  useLayoutEffect(() => {
    globalThis.scrollTo?.(0, 0);
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    store.load().then((loaded) => {
      if (cancelled) return;
      const data = loaded ?? emptySave(PLAYER_ID);
      setSave(data);
      if (data.activeEncounter && !findTemplate(data.activeEncounter.spec.questId, data.activeEncounter.spec.monsterId)) {
        console.error('load failed', new Error(`Unknown Encounter ${data.activeEncounter.spec.questId}/${data.activeEncounter.spec.monsterId}`));
        setLoadFailed(true);
        return;
      }
      if (!data.character.name) setScreen(Screen.Create);
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
    case Screen.Quests:
      return <QuestListScreen quests={openQuests(save)} onPick={(q) => { setQuest(q); setScreen(Screen.Quest); }} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Quest:
      return <QuestScreen save={save} quest={quest} onPick={(i) => { setPick(quest.encounters[i]!); setScreen(Screen.Story); }} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Story:
      return <StoryPanelScreen quest={quest} encounter={pick} onFight={() => fight(save, pick)} />;
    case Screen.Closing:
      return <ClosingPanelScreen quest={quest} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Encounter:
      return (
        <EncounterScreen
          key={encounter!.spec.id}
          save={save}
          encounter={encounter!}
          template={templateFor(encounter!)}
          onSave={persist}
          onFinish={(data, finished) => {
            persist(data);
            setEncounter(finished);
            setLoot(revealFor(data, finished));
            setEarned(saveBefore ? newlyEarned(saveBefore, data) : []);
            setScreen(Screen.Result);
          }}
          now={now}
          rng={rng}
        />
      );
    case Screen.Result: {
      // The closing panel belongs to a won boss fight in its Quest: never a Retreat, never a Survival fight.
      const fought = questOf(encounter!);
      const boss = fought?.encounters[fought.encounters.length - 1];
      const bossWon = fought !== undefined && encounter!.status === EncounterStatus.Won && encounter!.spec.monsterId === boss!.monsterId;
      return (
        <ResultScreen
          save={save}
          encounter={encounter!}
          xpBefore={xpBefore}
          continueLabel="Continue"
          onAgain={() => setScreen(bossWon ? Screen.Closing : fought ? Screen.Quest : Screen.Title)}
          onTitle={() => setScreen(Screen.Title)}
          saveFailed={saveFailed}
          loot={loot ?? undefined}
          earned={earned}
        />
      );
    }
    case Screen.Survival:
      return (
        <SurvivalScreen
          key={runKey}
          save={save}
          roster={survivalRoster(QUEST_1)}
          onSave={persist}
          onEnd={(data, run, newBest) => {
            persist(data);
            setRunResult({ run, newBest });
            setEarned(saveBefore ? newlyEarned(saveBefore, data) : []);
            setScreen(Screen.SurvivalResult);
          }}
          now={now}
          rng={rng}
        />
      );
    case Screen.SurvivalResult:
      return (
        <SurvivalResultScreen
          wins={runResult!.run.wins}
          xpGained={save.character.xp - xpBefore}
          best={save.character.survivalBest}
          newBest={runResult!.newBest}
          onAgain={() => survive(save)}
          onTitle={() => setScreen(Screen.Title)}
          saveFailed={saveFailed}
          earned={earned}
        />
      );
    case Screen.Trophies:
      return <TrophyCaseScreen save={save} onTitle={() => setScreen(Screen.Title)} />;
    case Screen.Guide:
      return (
        <GuideScreen
          save={save}
          onSave={persist}
          onReset={() => { persist(emptySave(PLAYER_ID)); setScreen(Screen.Create); }}
          onTitle={() => setScreen(save.character.name ? Screen.Title : Screen.Create)}
          now={now}
        />
      );
    default:
      return <TitleScreen save={save} onPlay={() => play(save)} onSurvival={() => survive(save)} onTrophies={() => setScreen(Screen.Trophies)} onGuide={() => setScreen(Screen.Guide)} saveFailed={saveFailed} />;
  }
}
