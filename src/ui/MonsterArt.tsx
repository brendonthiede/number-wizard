import { useState } from 'react';
import { art } from './art';

/** The monster's image; renders nothing once the file fails to load, so unshipped art never shows a broken icon. */
export function MonsterArt({ monsterId }: { monsterId: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img className="monster" src={art(`monster/${monsterId}.png`)} alt="" onError={() => setMissing(true)} />;
}
