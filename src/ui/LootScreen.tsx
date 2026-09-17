import { LOOT } from '../content/quest1';
import { ownedLoot } from '../game/loot';
import type { SaveData } from '../storage/save';
import { LootArt } from './LootArt';

/** The collection: every Loot in the pool as a slot, owned ones in colour with a name, the rest a silhouette. */
export function LootScreen({ save, onTitle }: { save: SaveData; onTitle: () => void }) {
  const owned = ownedLoot(save);
  const ids = Object.keys(LOOT);
  return (
    <main className="screen loot-screen">
      <h1>Loot</h1>
      <p>{owned.size} of {ids.length}</p>
      <ul className="loot-grid">
        {ids.map((id) => (
          <li key={id} className={owned.has(id) ? 'loot-slot' : 'loot-slot unowned'}>
            <LootArt id={id} />
            {owned.has(id) ? <span className="loot-name">{LOOT[id]}</span> : <span className="loot-mark">?</span>}
          </li>
        ))}
      </ul>
      <button type="button" className="primary" onClick={onTitle} autoFocus>Title</button>
    </main>
  );
}
