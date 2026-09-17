import { useState } from 'react';
import { art } from './art';

/** A Loot item's image; renders nothing once the file fails to load, so unshipped art never shows a broken icon. */
export function LootArt({ id }: { id: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img className="loot" src={art(`loot/${id}.png`)} alt="" onError={() => setMissing(true)} />;
}
