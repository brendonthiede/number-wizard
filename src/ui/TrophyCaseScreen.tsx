import { LOOT } from '../content/quest1';
import { ACHIEVEMENT_COUNT, achievements } from '../game/achievements';
import { ownedLoot } from '../game/loot';
import type { SaveData } from '../storage/save';
import { LootArt } from './LootArt';

/** Everything the Character has earned: the Loot grid and the Achievement list, both derived from the save. */
export function TrophyCaseScreen({ save, onTitle }: { save: SaveData; onTitle: () => void }) {
  const owned = ownedLoot(save);
  const ids = Object.keys(LOOT);
  // Count is pool-scoped: a won record can carry a retired id no longer in LOOT, which must not inflate the total.
  const ownedHere = ids.filter((id) => owned.has(id));
  const list = achievements(save);
  const earnedCount = list.filter((a) => a.earnedAt !== null).length;
  return (
    <main className="screen loot-screen">
      <h1>Trophy Case</h1>
      <h2>Loot</h2>
      <p>{ownedHere.length} of {ids.length}</p>
      <ul className="loot-grid">
        {ids.map((id) => (
          <li key={id} className={owned.has(id) ? 'loot-slot' : 'loot-slot unowned'}>
            <LootArt id={id} />
            {owned.has(id) ? <span className="loot-name">{LOOT[id]}</span> : <span className="loot-mark">?</span>}
          </li>
        ))}
      </ul>
      <h2>Achievements</h2>
      <p>{earnedCount} of {ACHIEVEMENT_COUNT}</p>
      <ul className="achievements">
        {list.map((a) => (
          <li key={a.id} className={a.earnedAt ? 'achievement earned' : 'achievement'}>
            <span className="medal-glyph" aria-hidden="true" />
            <span className="achievement-text">
              <span className="achievement-name">{a.name}</span>
              <span className="achievement-hint">{a.hint}</span>
              {a.earnedAt && <span className="achievement-date">{new Date(a.earnedAt).toLocaleDateString()}</span>}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="primary" onClick={onTitle} autoFocus>Title</button>
    </main>
  );
}
