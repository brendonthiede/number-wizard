import { useState } from 'react';
import { PORTRAITS } from '../content';
import { art } from './art';

export function CreateScreen({ onBegin }: { onBegin: (name: string, portrait: string) => void }) {
  const [name, setName] = useState('');
  const [portrait, setPortrait] = useState<string | null>(null);
  const ready = name.trim().length > 0 && portrait !== null;
  return (
    <main className="screen create">
      <h1>Who are you?</h1>
      <label>
        Name <input className="name" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="portraits" role="radiogroup" aria-label="Portrait">
        {PORTRAITS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={portrait === p} aria-label={p} className="portrait-card" onClick={() => setPortrait(p)}>
            <img src={art(`character/${p}.png`)} alt="" />
          </button>
        ))}
      </div>
      <button type="button" className="primary" disabled={!ready} onClick={() => onBegin(name.trim(), portrait!)}>Begin</button>
    </main>
  );
}
